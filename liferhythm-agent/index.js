#!/usr/bin/env node
/**
 * LifeRhythm Agent CLI
 *
 * Usage:
 *   # Single update
 *   node index.js "I called for garbage tags Monday, remind me in 7-10 days if they don't arrive"
 *
 *   # Interactive mode
 *   node index.js --interactive
 *   node index.js -i
 *
 *   # Custom MCP server path
 *   MCP_SERVER_PATH=/path/to/mcp node index.js "..."
 *
 *   # Custom sheet ID
 *   SHEET_ID=your_sheet_id node index.js "..."
 */

import { createInterface } from 'readline';
import { LifeRhythmAgent } from './agent.js';

const MCP_SERVER_PATH = process.env.MCP_SERVER_PATH;
const SHEET_ID = process.env.SHEET_ID;

async function main() {
  const args = process.argv.slice(2);
  const interactive = args.includes('--interactive') || args.includes('-i');
  const input = args.filter(a => !a.startsWith('-')).join(' ');

  const agent = new LifeRhythmAgent({
    ...(MCP_SERVER_PATH && { mcpServerPath: MCP_SERVER_PATH }),
    ...(SHEET_ID && { sheetId: SHEET_ID }),
  });

  console.log('LifeRhythm Agent connecting...');
  try {
    const tools = await agent.connect();
    console.log(`Connected. ${tools.length} tool(s) available: ${tools.map(t => t.name).join(', ')}\n`);
  } catch (err) {
    console.error(`Failed to connect to MCP server: ${err.message}`);
    console.error('Make sure ~/liferhythm-mcp/ exists and has a working index.js');
    process.exit(1);
  }

  if (interactive) {
    await runInteractive(agent);
  } else if (input) {
    await runSingle(agent, input);
  } else {
    printUsage();
    await agent.disconnect();
    process.exit(1);
  }

  await agent.disconnect();
}

async function runSingle(agent, input) {
  console.log(`> ${input}\n`);
  try {
    const { response, actions } = await agent.process(input);
    if (actions.length > 0) {
      console.log(`[Actions taken: ${actions.map(a => a.tool).join(', ')}]`);
    }
    console.log(response);
  } catch (err) {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  }
}

async function runInteractive(agent) {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: 'You: ',
  });

  console.log('LifeRhythm Agent ready. Type your update (or "quit" to exit).\n');
  console.log('Examples:');
  console.log('  "I called for garbage tags Monday, remind me in 7-10 days if they don\'t arrive"');
  console.log('  "Paid hydro bill today"');
  console.log('  "What tasks are overdue?"');
  console.log('  "Doctor appointment scheduled for March 5th"\n');

  rl.prompt();

  rl.on('line', async line => {
    const input = line.trim();

    if (!input) {
      rl.prompt();
      return;
    }

    if (input.toLowerCase() === 'quit' || input.toLowerCase() === 'exit') {
      console.log('Goodbye!');
      rl.close();
      return;
    }

    rl.pause();
    try {
      const { response, actions } = await agent.process(input);
      if (actions.length > 0) {
        console.log(`\n[Actions: ${actions.map(a => a.tool).join(', ')}]`);
      }
      console.log(`\nAssistant: ${response}\n`);
    } catch (err) {
      console.error(`\nError: ${err.message}\n`);
    }
    rl.resume();
    rl.prompt();
  });

  rl.on('close', () => {
    process.exit(0);
  });

  // Keep alive until readline closes
  await new Promise(resolve => rl.on('close', resolve));
}

function printUsage() {
  console.log(`
Usage:
  node index.js "your natural language update"
  node index.js --interactive

Examples:
  node index.js "I called for garbage tags Monday, remind me in 7-10 days if they don't arrive"
  node index.js "Paid hydro bill today"
  node index.js --interactive

Environment variables:
  MCP_SERVER_PATH   Path to liferhythm-mcp directory (default: ~/liferhythm-mcp)
  SHEET_ID          Google Sheets ID (default: built-in)
  ANTHROPIC_API_KEY Your Anthropic API key (required)
`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
