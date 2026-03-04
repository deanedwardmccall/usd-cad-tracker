import { describe, it, expect } from 'vitest';
import { postgresConnector } from './index.js';

describe('postgresConnector', () => {
  it('has correct metadata', () => {
    expect(postgresConnector.name).toBe('PostgreSQL');
    expect(postgresConnector.type).toBe('database');
    expect(postgresConnector.status).toBe('stable');
  });

  describe('validateOptions', () => {
    it('accepts a connection string', () => {
      const result = postgresConnector.validateOptions({
        connectionString: 'postgresql://user:pass@localhost/mydb',
      });
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('accepts individual host/db params', () => {
      const result = postgresConnector.validateOptions({
        host: 'localhost',
        db: 'mydb',
        user: 'user',
        password: 'pass',
      });
      expect(result.valid).toBe(true);
    });

    it('rejects empty options', () => {
      const result = postgresConnector.validateOptions({});
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('--connection-string');
    });
  });
});
