import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Database from 'better-sqlite3';
import { mkdtempSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { sqliteConnector } from './index.js';

let tmpDir: string;
let dbPath: string;

beforeAll(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'mcpeasy-test-'));
  dbPath = join(tmpDir, 'test.sqlite');

  const db = new Database(dbPath);
  db.exec(`
    CREATE TABLE users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE
    );
    CREATE TABLE posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      title TEXT NOT NULL,
      body TEXT
    );
    INSERT INTO users (name, email) VALUES ('Alice', 'alice@example.com');
    INSERT INTO posts (user_id, title) VALUES (1, 'Hello World');
  `);
  db.close();
});

afterAll(() => {
  rmSync(tmpDir, { recursive: true });
});

describe('sqliteConnector', () => {
  it('has correct metadata', () => {
    expect(sqliteConnector.name).toBe('SQLite');
    expect(sqliteConnector.type).toBe('database');
    expect(sqliteConnector.status).toBe('stable');
  });

  describe('validateOptions', () => {
    it('accepts a file path', () => {
      const result = sqliteConnector.validateOptions({ file: '/path/to/db.sqlite' });
      expect(result.valid).toBe(true);
    });

    it('rejects missing file', () => {
      const result = sqliteConnector.validateOptions({});
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('--file');
    });
  });

  describe('introspect', () => {
    it('discovers tables, columns, PKs, FKs, and row counts', async () => {
      const schema = await sqliteConnector.introspect({ file: dbPath });

      expect(schema.sourceType).toBe('sqlite');
      expect(schema.tables).toHaveLength(2);

      const users = schema.tables.find((t) => t.name === 'users')!;
      expect(users).toBeDefined();
      expect(users.rowCountEstimate).toBe(1);

      const idCol = users.columns.find((c) => c.name === 'id')!;
      expect(idCol.isPrimaryKey).toBe(true);

      const posts = schema.tables.find((t) => t.name === 'posts')!;
      const fkCol = posts.columns.find((c) => c.name === 'user_id')!;
      expect(fkCol.isForeignKey).toBe(true);
      expect(fkCol.references?.table).toBe('users');
    });
  });
});
