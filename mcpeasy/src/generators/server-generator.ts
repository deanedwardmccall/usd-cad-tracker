import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import type { DataSourceSchema, TableSchema } from '../connectors/types.js';
import { log } from '../utils/logger.js';

interface GenerateServerOptions {
  outputDir: string;
  serverName: string;
  source: string;
  schema: DataSourceSchema;
  readOnly: boolean;
  connectorType: 'database' | 'api';
}

function generateToolsForTable(table: TableSchema, readOnly: boolean): string {
  const tools: string[] = [];
  const tableName = table.name;

  // query tool (always)
  tools.push(`  server.tool(
    "query_${tableName}",
    "Query rows from the ${tableName} table",
    {
      where: z.string().optional().describe("SQL WHERE clause (without the WHERE keyword)"),
      orderBy: z.string().optional().describe("Column to order by"),
      limit: z.number().optional().default(50).describe("Max rows to return"),
    },
    async ({ where, orderBy, limit }) => {
      let sql = "SELECT * FROM ${tableName}";
      const params: any[] = [];
      if (where) { sql += " WHERE " + where; }
      if (orderBy) { sql += " ORDER BY " + orderBy; }
      sql += " LIMIT $" + (params.length + 1);
      params.push(limit || 50);
      const result = await pool.query(sql, params);
      return { content: [{ type: "text", text: JSON.stringify(result.rows, null, 2) }] };
    }
  );`);

  // describe tool (always)
  const colDescriptions = table.columns.map(c => {
    let desc = `${c.name}: ${c.type}`;
    if (c.isPrimaryKey) desc += ' (PK)';
    if (c.isForeignKey && c.references) desc += ` (FK → ${c.references.table}.${c.references.column})`;
    if (!c.nullable) desc += ' NOT NULL';
    return desc;
  }).join('\\n');

  tools.push(`  server.tool(
    "describe_${tableName}",
    "Get schema info for the ${tableName} table",
    {},
    async () => {
      return { content: [{ type: "text", text: \`Table: ${tableName} (~${table.rowCountEstimate} rows)\\n\\nColumns:\\n${colDescriptions}\` }] };
    }
  );`);

  // insert tool (unless read-only)
  if (!readOnly) {
    tools.push(`  server.tool(
    "insert_${tableName}",
    "Insert a row into the ${tableName} table",
    {
      data: z.record(z.any()).describe("Column name → value pairs to insert"),
    },
    async ({ data }) => {
      const cols = Object.keys(data);
      const vals = Object.values(data);
      const placeholders = cols.map((_, i) => "$" + (i + 1));
      const sql = \`INSERT INTO ${tableName} (\${cols.join(", ")}) VALUES (\${placeholders.join(", ")}) RETURNING *\`;
      const result = await pool.query(sql, vals);
      return { content: [{ type: "text", text: JSON.stringify(result.rows[0], null, 2) }] };
    }
  );`);
  }

  return tools.join('\n');
}

function generateServerCode(schema: DataSourceSchema, readOnly: boolean): string {
  const allTools = schema.tables.map(t => generateToolsForTable(t, readOnly)).join('\n');

  return `#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import pg from "pg";

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const server = new McpServer(
  { name: "${schema.sourceName}-mcp-server", version: "1.0.0" }
);

// ─── List all tables ───
server.tool(
  "list_tables",
  "List all available tables in the database",
  {},
  async () => {
    const tables = ${JSON.stringify(schema.tables.map(t => ({ name: t.name, columns: t.columns.length, rows: t.rowCountEstimate })), null, 4)};
    return { content: [{ type: "text", text: JSON.stringify(tables, null, 2) }] };
  }
);

// ─── Per-table tools ───
${allTools}

// ─── Start server ───
const transport = new StdioServerTransport();
await server.connect(transport);
console.error("MCP server running on stdio");
`;
}

function generatePackageJson(serverName: string): string {
  return JSON.stringify({
    name: serverName,
    version: "1.0.0",
    type: "module",
    scripts: {
      build: "tsc",
      start: "node dist/index.js",
    },
    dependencies: {
      "@modelcontextprotocol/sdk": "^1.0.0",
      pg: "^8.13.0",
      zod: "^3.22.0",
    },
    devDependencies: {
      "@types/node": "^20.0.0",
      "@types/pg": "^8.11.0",
      typescript: "^5.4.0",
    },
  }, null, 2);
}

function generateTsConfig(): string {
  return JSON.stringify({
    compilerOptions: {
      target: "ES2022",
      module: "Node16",
      moduleResolution: "Node16",
      outDir: "./dist",
      rootDir: "./src",
      strict: true,
      esModuleInterop: true,
      skipLibCheck: true,
    },
    include: ["src/**/*"],
  }, null, 2);
}

function generateEnvExample(source: string): string {
  if (source === 'postgres') {
    return `# Database connection\nDATABASE_URL=postgresql://user:password@localhost:5432/mydb\n`;
  }
  return `# Configuration\n# Add your connection details here\n`;
}

function generateManifest(serverName: string, source: string, schema: DataSourceSchema): string {
  return JSON.stringify({
    name: serverName,
    source,
    generatedBy: "mcpeasy",
    generatedAt: new Date().toISOString(),
    tables: schema.tables.map(t => t.name),
    version: "0.1.0-alpha",
  }, null, 2);
}

function generateReadme(serverName: string, source: string, schema: DataSourceSchema): string {
  const tableList = schema.tables.map(t =>
    `| ${t.name} | ${t.columns.length} | ~${t.rowCountEstimate} |`
  ).join('\n');

  return `# ${serverName}

Auto-generated MCP server for ${source} database \`${schema.sourceName}\`.

Generated by [MCPeasy](https://github.com/deanmccall/mcpeasy).

## Setup

\`\`\`bash
npm install
cp .env.example .env  # Edit with your connection details
npm run build
\`\`\`

## Connect to Claude Desktop

Add to your \`claude_desktop_config.json\`:

\`\`\`json
{
  "mcpServers": {
    "${serverName}": {
      "command": "node",
      "args": ["${process.cwd()}/${serverName}/dist/index.js"],
      "env": {
        "DATABASE_URL": "your-connection-string"
      }
    }
  }
}
\`\`\`

Or use: \`mcpeasy install ./${serverName}\`

## Available Tables

| Table | Columns | Est. Rows |
|-------|---------|-----------|
${tableList}

## Tools

For each table, the following MCP tools are available:
- \`query_<table>\` — SELECT with WHERE, ORDER BY, LIMIT
- \`describe_<table>\` — Column names, types, relationships
- \`insert_<table>\` — INSERT with parameterized values
- \`list_tables\` — Show all available tables
`;
}

function generateClaudeConfig(serverName: string, outputDir: string): string {
  return JSON.stringify({
    mcpServers: {
      [serverName]: {
        command: "node",
        args: [`${outputDir}/dist/index.js`],
        env: {
          DATABASE_URL: "YOUR_CONNECTION_STRING_HERE"
        }
      }
    }
  }, null, 2);
}

export async function generateServer(options: GenerateServerOptions): Promise<void> {
  const { outputDir, serverName, source, schema, readOnly } = options;

  // Create directory structure
  await mkdir(join(outputDir, 'src'), { recursive: true });

  // Generate all files
  const files: [string, string][] = [
    [join(outputDir, 'src', 'index.ts'), generateServerCode(schema, readOnly)],
    [join(outputDir, 'package.json'), generatePackageJson(serverName)],
    [join(outputDir, 'tsconfig.json'), generateTsConfig()],
    [join(outputDir, '.env.example'), generateEnvExample(source)],
    [join(outputDir, 'mcpeasy.json'), generateManifest(serverName, source, schema)],
    [join(outputDir, 'README.md'), generateReadme(serverName, source, schema)],
    [join(outputDir, 'claude_desktop_config.snippet.json'), generateClaudeConfig(serverName, outputDir)],
  ];

  for (const [path, content] of files) {
    await writeFile(path, content, 'utf-8');
    log.success(`Created ${path}`);
  }
}
