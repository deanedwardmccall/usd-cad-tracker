/**
 * LifeRhythm Intelligence Layer
 *
 * Wraps the LifeRhythm MCP server with natural language understanding.
 * Accepts conversational updates, uses Claude to parse intent, and
 * executes the appropriate MCP tool calls against Google Sheets.
 *
 * Example input:
 *   "I called for garbage tags Monday, remind me in 7-10 days if they don't arrive"
 *
 * What it does:
 *   1. Connects to the MCP server at ~/liferhythm-mcp/
 *   2. Discovers available tools
 *   3. Sends your message + tools to Claude
 *   4. Executes Claude's tool calls against the MCP server
 *   5. Returns a friendly summary
 */

import Anthropic from '@anthropic-ai/sdk';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { resolve } from 'path';
import { homedir } from 'os';

// Sheet ID should come from environment — not hardcoded in source.
// Set LIFERHYTHM_SHEET_ID in your .env file (see .env.example).
const SHEET_ID = process.env.LIFERHYTHM_SHEET_ID || '1XJ5oA-FjBx7P_bn-gM2qL_Y5rXYFbFhSsw74ejyph-E';
const MCP_SERVER_PATH = process.env.MCP_SERVER_PATH || resolve(homedir(), 'liferhythm-mcp');

// Maximum number of agentic tool-call turns per request.
// Prevents runaway loops from prompt injection or model issues.
const MAX_TURNS = 10;

const SYSTEM_PROMPT = `You are the LifeRhythm assistant — an AI that helps manage a person's life rhythm through natural conversation.

You have access to tools that read and write a personal task/reminder database (Google Sheets).

## Your job
When the user gives you a conversational update, understand what they mean and take the right actions:
- Log events, tasks, and things they've done
- Set follow-up reminders with exact dates
- Search and retrieve existing items when asked
- Update statuses as things progress

## Date handling
Today's date will be provided in the user's message. Use it to resolve:
- "Monday" → the most recent Monday
- "last week" → 7 days ago
- "in 7-10 days" → today + 7 days (min) and today + 10 days (max)
- Always produce ISO 8601 dates (YYYY-MM-DD) when calling tools

## Reminders
When the user says "remind me in X-Y days if [condition]":
- Create a reminder with reminder_date = today + X days
- Set reminder_max_date = today + Y days
- Store the condition in the notes field

## Response style
After taking actions, give a brief, friendly confirmation. Tell the user:
- What you logged
- When any reminders are set for
- What to expect next

Keep responses concise — 2-4 sentences is ideal.`;

export class LifeRhythmAgent {
  constructor({ mcpServerPath = MCP_SERVER_PATH, sheetId = SHEET_ID } = {}) {
    this.mcpServerPath = mcpServerPath;
    this.sheetId = sheetId;
    this.anthropic = new Anthropic();
    this.mcpClient = null;
    this.tools = [];
  }

  /**
   * Connect to the MCP server and discover its tools.
   * Must be called before process().
   */
  async connect() {
    this.mcpClient = new Client(
      { name: 'liferhythm-agent', version: '1.0.0' },
      { capabilities: {} }
    );

    // Explicitly whitelist env vars passed to the MCP subprocess.
    // Never forward the full process.env — it contains API keys and credentials.
    const mcpEnv = {
      PATH: process.env.PATH,
      HOME: process.env.HOME,
      NODE_ENV: process.env.NODE_ENV || 'production',
      LIFERHYTHM_SHEET_ID: this.sheetId,
      // Google credentials — MCP server needs one of these:
      GOOGLE_APPLICATION_CREDENTIALS: process.env.GOOGLE_APPLICATION_CREDENTIALS,
      GOOGLE_SERVICE_ACCOUNT_EMAIL: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      GOOGLE_PRIVATE_KEY: process.env.GOOGLE_PRIVATE_KEY,
    };
    // Strip undefined keys so the child doesn't see them at all
    Object.keys(mcpEnv).forEach(k => mcpEnv[k] === undefined && delete mcpEnv[k]);

    const transport = new StdioClientTransport({
      command: 'node',
      args: ['index.js'],
      cwd: this.mcpServerPath,
      env: mcpEnv,
    });

    await this.mcpClient.connect(transport);

    const { tools } = await this.mcpClient.listTools();
    this.tools = tools.map(tool => ({
      name: tool.name,
      description: tool.description,
      input_schema: tool.inputSchema,
    }));

    return this.tools;
  }

  /**
   * Disconnect from the MCP server.
   */
  async disconnect() {
    if (this.mcpClient) {
      await this.mcpClient.close();
      this.mcpClient = null;
    }
  }

  /**
   * Process a natural language update.
   *
   * @param {string} input - Conversational input from the user
   * @param {Date} [now] - Current date (defaults to new Date())
   * @returns {Promise<{response: string, actions: Array}>}
   */
  async process(input, now = new Date()) {
    const dateContext = formatDateContext(now);
    const userMessage = `${dateContext}\n\n${input}`;

    const messages = [{ role: 'user', content: userMessage }];
    const actions = [];
    let turns = 0;

    // Agentic loop: keep going until Claude stops calling tools or we hit the limit
    while (turns < MAX_TURNS) {
      turns++;
      const response = await this.anthropic.messages.create({
        model: 'claude-opus-4-6',
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        tools: this.tools,
        messages,
      });

      // Collect any text Claude emitted
      const textBlocks = response.content.filter(b => b.type === 'text');
      const toolUseBlocks = response.content.filter(b => b.type === 'tool_use');

      // If no tool calls, we're done
      if (response.stop_reason === 'end_turn' || toolUseBlocks.length === 0) {
        const finalText = textBlocks.map(b => b.text).join('').trim();
        return { response: finalText, actions };
      }

      // Add Claude's response to the conversation
      messages.push({ role: 'assistant', content: response.content });

      // Execute each tool call
      const toolResults = [];
      for (const toolUse of toolUseBlocks) {
        const result = await this._callTool(toolUse.name, toolUse.input);
        actions.push({ tool: toolUse.name, input: toolUse.input, result });
        toolResults.push({
          type: 'tool_result',
          tool_use_id: toolUse.id,
          content: JSON.stringify(result),
        });
      }

      // Feed results back to Claude
      messages.push({ role: 'user', content: toolResults });
    }

    throw new Error(`Agent exceeded maximum turns (${MAX_TURNS}). Aborting to prevent runaway tool calls.`);
  }

  /**
   * Call an MCP tool by name.
   */
  async _callTool(toolName, toolInput) {
    if (!this.mcpClient) {
      throw new Error('Not connected to MCP server. Call connect() first.');
    }
    const result = await this.mcpClient.callTool({
      name: toolName,
      arguments: toolInput,
    });
    return result;
  }
}

/**
 * Build a date context string so Claude knows what "Monday" etc. means.
 */
function formatDateContext(date) {
  const iso = date.toISOString().split('T')[0];
  const weekday = date.toLocaleDateString('en-CA', { weekday: 'long' });
  const readable = date.toLocaleDateString('en-CA', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  // Calculate recent weekday dates so Claude can resolve "Monday", "Tuesday", etc.
  const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const todayIdx = date.getDay();
  const recentWeekdays = weekdays.map((name, idx) => {
    const diff = (todayIdx - idx + 7) % 7;
    const d = new Date(date);
    d.setDate(d.getDate() - diff);
    return `${name}: ${d.toISOString().split('T')[0]}`;
  });

  return [
    `[DATE CONTEXT]`,
    `Today is ${readable} (${iso}).`,
    `Recent dates for reference:`,
    ...recentWeekdays.map(s => `  ${s}`),
    `[/DATE CONTEXT]`,
  ].join('\n');
}

export { formatDateContext, SHEET_ID, MCP_SERVER_PATH };
