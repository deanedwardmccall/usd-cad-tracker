import { describe, it, expect } from 'vitest';
import { stripeConnector } from './index.js';

describe('stripeConnector', () => {
  it('has correct metadata', () => {
    expect(stripeConnector.name).toBe('Stripe');
    expect(stripeConnector.type).toBe('api');
    expect(stripeConnector.status).toBe('stable');
  });

  describe('validateOptions', () => {
    it('accepts an api key', () => {
      const result = stripeConnector.validateOptions({ apiKey: 'sk_test_abc123' });
      expect(result.valid).toBe(true);
    });

    it('rejects missing api key', () => {
      const result = stripeConnector.validateOptions({});
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('--api-key');
    });
  });
});
