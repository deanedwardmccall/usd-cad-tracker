import { describe, it, expect } from 'vitest';
import { mysqlConnector } from './index.js';

describe('mysqlConnector', () => {
  it('has correct metadata', () => {
    expect(mysqlConnector.name).toBe('MySQL');
    expect(mysqlConnector.type).toBe('database');
    expect(mysqlConnector.status).toBe('stable');
  });

  describe('validateOptions', () => {
    it('accepts a connection string', () => {
      const result = mysqlConnector.validateOptions({
        connectionString: 'mysql://user:pass@localhost/mydb',
      });
      expect(result.valid).toBe(true);
    });

    it('accepts individual db param', () => {
      const result = mysqlConnector.validateOptions({ db: 'mydb', user: 'root' });
      expect(result.valid).toBe(true);
    });

    it('rejects empty options', () => {
      const result = mysqlConnector.validateOptions({});
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('--connection-string');
    });
  });
});
