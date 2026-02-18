/**
 * LifeRhythm Agent Tests
 *
 * Tests the date context builder and the agent's agentic loop logic
 * without requiring a live MCP server or Anthropic API key.
 */

import { jest } from '@jest/globals';
import { formatDateContext, LifeRhythmAgent } from './agent.js';

// ─── formatDateContext ────────────────────────────────────────────────────────

describe('formatDateContext', () => {
  // Wednesday 2026-02-18
  const wednesday = new Date('2026-02-18T12:00:00.000Z');

  test('includes ISO date for today', () => {
    const ctx = formatDateContext(wednesday);
    expect(ctx).toContain('2026-02-18');
  });

  test('includes weekday name', () => {
    const ctx = formatDateContext(wednesday);
    expect(ctx).toMatch(/Wednesday/i);
  });

  test('resolves Monday to the most recent Monday', () => {
    // 2026-02-18 is a Wednesday; most recent Monday is 2026-02-16
    const ctx = formatDateContext(wednesday);
    expect(ctx).toContain('Monday: 2026-02-16');
  });

  test('resolves Sunday to 2 days ago when today is Tuesday', () => {
    // 2026-02-17 is a Tuesday; most recent Sunday is 2026-02-15
    const tuesday = new Date('2026-02-17T12:00:00.000Z');
    const ctx = formatDateContext(tuesday);
    expect(ctx).toContain('Sunday: 2026-02-15');
  });

  test('includes all 7 weekday lines', () => {
    const ctx = formatDateContext(wednesday);
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    for (const day of days) {
      expect(ctx).toContain(day);
    }
  });

  test('wraps output in DATE CONTEXT markers', () => {
    const ctx = formatDateContext(wednesday);
    expect(ctx).toContain('[DATE CONTEXT]');
    expect(ctx).toContain('[/DATE CONTEXT]');
  });

  test('today weekday maps to todays date (diff = 0)', () => {
    // Wednesday 2026-02-18
    const ctx = formatDateContext(wednesday);
    expect(ctx).toContain('Wednesday: 2026-02-18');
  });
});

// ─── LifeRhythmAgent (unit, no live connections) ─────────────────────────────

describe('LifeRhythmAgent', () => {
  test('uses default SHEET_ID when none provided', () => {
    const agent = new LifeRhythmAgent();
    expect(agent.sheetId).toBe('1XJ5oA-FjBx7P_bn-gM2qL_Y5rXYFbFhSsw74ejyph-E');
  });

  test('accepts custom sheetId', () => {
    const agent = new LifeRhythmAgent({ sheetId: 'custom-sheet-123' });
    expect(agent.sheetId).toBe('custom-sheet-123');
  });

  test('initializes with empty tools list before connect()', () => {
    const agent = new LifeRhythmAgent();
    expect(agent.tools).toEqual([]);
  });

  test('mcpClient is null before connect()', () => {
    const agent = new LifeRhythmAgent();
    expect(agent.mcpClient).toBeNull();
  });

  test('process() throws if not connected', async () => {
    const agent = new LifeRhythmAgent();
    // Mock anthropic to return a tool_use response that triggers _callTool
    agent.anthropic = {
      messages: {
        create: async () => ({
          stop_reason: 'tool_use',
          content: [
            {
              type: 'tool_use',
              id: 'tu_123',
              name: 'create_item',
              input: { title: 'Garbage tags' },
            },
          ],
        }),
      },
    };
    await expect(agent.process('test')).rejects.toThrow('Not connected');
  });

  test('process() returns text response when Claude stops with end_turn', async () => {
    const agent = new LifeRhythmAgent();
    agent.tools = [];
    agent.anthropic = {
      messages: {
        create: async () => ({
          stop_reason: 'end_turn',
          content: [{ type: 'text', text: 'Done! Logged your update.' }],
        }),
      },
    };

    const { response, actions } = await agent.process('Paid hydro bill');
    expect(response).toBe('Done! Logged your update.');
    expect(actions).toHaveLength(0);
  });

  test('process() executes tool calls and feeds results back', async () => {
    const agent = new LifeRhythmAgent();
    agent.tools = [];

    const callToolMock = jest.fn().mockResolvedValue({ success: true, id: 'row_42' });
    agent._callTool = callToolMock;

    // First call: Claude requests a tool use
    // Second call: Claude says end_turn after seeing tool result
    let callCount = 0;
    agent.anthropic = {
      messages: {
        create: async () => {
          callCount++;
          if (callCount === 1) {
            return {
              stop_reason: 'tool_use',
              content: [
                {
                  type: 'tool_use',
                  id: 'tu_abc',
                  name: 'create_item',
                  input: { title: 'Garbage tags', status: 'ordered' },
                },
              ],
            };
          }
          return {
            stop_reason: 'end_turn',
            content: [{ type: 'text', text: 'Logged! Reminder set.' }],
          };
        },
      },
    };

    const { response, actions } = await agent.process('I called for garbage tags Monday');
    expect(response).toBe('Logged! Reminder set.');
    expect(actions).toHaveLength(1);
    expect(actions[0].tool).toBe('create_item');
    expect(actions[0].input).toEqual({ title: 'Garbage tags', status: 'ordered' });
    expect(actions[0].result).toEqual({ success: true, id: 'row_42' });
    expect(callToolMock).toHaveBeenCalledWith('create_item', { title: 'Garbage tags', status: 'ordered' });
  });

  test('process() handles multiple tool calls in a single turn', async () => {
    const agent = new LifeRhythmAgent();
    agent.tools = [];

    const callToolMock = jest.fn().mockResolvedValue({ success: true });
    agent._callTool = callToolMock;

    let callCount = 0;
    agent.anthropic = {
      messages: {
        create: async () => {
          callCount++;
          if (callCount === 1) {
            return {
              stop_reason: 'tool_use',
              content: [
                { type: 'tool_use', id: 'tu_1', name: 'create_item', input: { title: 'Task A' } },
                { type: 'tool_use', id: 'tu_2', name: 'add_reminder', input: { item_id: 'row_1', days: 7 } },
              ],
            };
          }
          return {
            stop_reason: 'end_turn',
            content: [{ type: 'text', text: 'All done.' }],
          };
        },
      },
    };

    const { actions } = await agent.process('Create task A and set a 7-day reminder');
    expect(actions).toHaveLength(2);
    expect(actions[0].tool).toBe('create_item');
    expect(actions[1].tool).toBe('add_reminder');
    expect(callToolMock).toHaveBeenCalledTimes(2);
  });
});
