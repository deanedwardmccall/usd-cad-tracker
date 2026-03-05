import { describe, it, expect } from 'vitest';
import { slackConnector } from './index.js';

describe('slackConnector', () => {
  it('has correct metadata', () => {
    expect(slackConnector.name).toBe('Slack');
    expect(slackConnector.type).toBe('api');
    expect(slackConnector.status).toBe('stable');
  });

  describe('validateOptions', () => {
    it('accepts a bot token', () => {
      const result = slackConnector.validateOptions({ token: 'xoxb-test-token' });
      expect(result.valid).toBe(true);
    });

    it('rejects missing token', () => {
      const result = slackConnector.validateOptions({});
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('--token');
    });
  });
});
