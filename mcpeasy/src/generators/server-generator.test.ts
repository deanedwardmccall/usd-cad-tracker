import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { generateServer } from './server-generator.js';
import type { DataSourceSchema } from '../connectors/types.js';

const sampleSchema: DataSourceSchema = {
  sourceType: 'postgres',
  sourceName: 'testdb',
  tables: [
    {
      name: 'users',
      schema: 'public',
      rowCountEstimate: 42,
      columns: [
        { name: 'id', type: 'integer', nullable: false, isPrimaryKey: true, isForeignKey: false, defaultValue: 'nextval(...)' },
        { name: 'email', type: 'text', nullable: false, isPrimaryKey: false, isForeignKey: false },
        { name: 'org_id', type: 'integer', nullable: true, isPrimaryKey: false, isForeignKey: true,
          references: { table: 'orgs', column: 'id' } },
      ],
    },
  ],
  metadata: { version: 'PostgreSQL 16', tableCount: 1 },
};

let tmpDir: string;

beforeAll(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'mcpeasy-gen-test-'));
});

afterAll(() => {
  rmSync(tmpDir, { recursive: true });
});

describe('generateServer', () => {
  it('creates all expected files', async () => {
    const outputDir = join(tmpDir, 'test-server');
    await generateServer({
      outputDir,
      serverName: 'test-server',
      source: 'postgres',
      schema: sampleSchema,
      readOnly: false,
      connectorType: 'database',
    });

    const expected = [
      'src/index.ts',
      'package.json',
      'tsconfig.json',
      '.env.example',
      'mcpeasy.json',
      'README.md',
      'claude_desktop_config.snippet.json',
    ];

    for (const file of expected) {
      expect(existsSync(join(outputDir, file)), `missing: ${file}`).toBe(true);
    }
  });

  it('generated src/index.ts uses McpServer and imports pg', async () => {
    const outputDir = join(tmpDir, 'test-server');
    const src = readFileSync(join(outputDir, 'src', 'index.ts'), 'utf-8');
    expect(src).toContain('McpServer');
    expect(src).toContain('from "@modelcontextprotocol/sdk/server/mcp.js"');
    expect(src).toContain('pg');
    expect(src).toContain('query_users');
    expect(src).toContain('describe_users');
    expect(src).toContain('insert_users');
  });

  it('generated mcpeasy.json has correct manifest', async () => {
    const outputDir = join(tmpDir, 'test-server');
    const manifest = JSON.parse(readFileSync(join(outputDir, 'mcpeasy.json'), 'utf-8'));
    expect(manifest.name).toBe('test-server');
    expect(manifest.source).toBe('postgres');
    expect(manifest.generatedBy).toBe('mcpeasy');
    expect(manifest.tables).toContain('users');
  });

  it('read-only mode omits insert tools', async () => {
    const outputDir = join(tmpDir, 'readonly-server');
    await generateServer({
      outputDir,
      serverName: 'readonly-server',
      source: 'postgres',
      schema: sampleSchema,
      readOnly: true,
      connectorType: 'database',
    });
    const src = readFileSync(join(outputDir, 'src', 'index.ts'), 'utf-8');
    expect(src).not.toContain('insert_users');
    expect(src).toContain('query_users');
  });
});
