import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { postgresConnector } from './index.js';

// ============================================================
// Unit Tests — no Docker required
// ============================================================
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

// ============================================================
// Integration Tests — require Docker
// ============================================================
async function isDockerAvailable(): Promise<boolean> {
  try {
    const { execa } = await import('execa').catch(() => ({ execa: null }));
    if (!execa) {
      const { execSync } = await import('child_process');
      execSync('docker info', { stdio: 'ignore', timeout: 3000 });
      return true;
    }
    await execa('docker', ['info'], { timeout: 3000 });
    return true;
  } catch {
    return false;
  }
}

describe('postgresConnector (Docker integration)', () => {
  let container: import('@testcontainers/postgresql').StartedPostgreSqlContainer | null = null;
  let connectionString: string;
  let dockerAvailable = false;

  beforeAll(async () => {
    const { execSync } = await import('child_process');
    try {
      execSync('docker info', { stdio: 'ignore', timeout: 3000 });
      dockerAvailable = true;
    } catch {
      dockerAvailable = false;
      return;
    }

    const { PostgreSqlContainer } = await import('@testcontainers/postgresql');
    const pg = await import('pg');
    const Client = pg.default.Client;

    container = await new PostgreSqlContainer('postgres:16').start();
    connectionString = container.getConnectionUri();

    const client = new Client({ connectionString });
    await client.connect();
    await client.query(`
      CREATE TABLE users (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT UNIQUE
      );
      CREATE TABLE posts (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id),
        title TEXT NOT NULL,
        body TEXT
      );
      INSERT INTO users (name, email) VALUES ('Alice', 'alice@example.com');
      INSERT INTO posts (user_id, title) VALUES (1, 'Hello World');
    `);
    await client.end();
  }, 120_000);

  afterAll(async () => {
    if (container) await container.stop();
  });

  it('discovers tables, columns, PKs, FKs, and row counts', async () => {
    if (!dockerAvailable) return;

    const schema = await postgresConnector.introspect({ connectionString });

    expect(schema.sourceType).toBe('postgres');
    expect(schema.tables).toHaveLength(2);

    const users = schema.tables.find((t) => t.name === 'users')!;
    expect(users).toBeDefined();

    const idCol = users.columns.find((c) => c.name === 'id')!;
    expect(idCol.isPrimaryKey).toBe(true);

    const posts = schema.tables.find((t) => t.name === 'posts')!;
    const fkCol = posts.columns.find((c) => c.name === 'user_id')!;
    expect(fkCol.isForeignKey).toBe(true);
    expect(fkCol.references?.table).toBe('users');
  });

  it('returns sourceType postgres', async () => {
    if (!dockerAvailable) return;

    const schema = await postgresConnector.introspect({ connectionString });
    expect(schema.sourceType).toBe('postgres');
  });

  it('includes database version in metadata', async () => {
    if (!dockerAvailable) return;

    const schema = await postgresConnector.introspect({ connectionString });
    expect(schema.metadata?.version).toContain('PostgreSQL');
  });

  it('reports correct tableCount in metadata', async () => {
    if (!dockerAvailable) return;

    const schema = await postgresConnector.introspect({ connectionString });
    expect(schema.metadata?.tableCount).toBe(2);
  });
});
