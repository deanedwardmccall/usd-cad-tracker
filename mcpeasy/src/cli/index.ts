#!/usr/bin/env node

import { Command } from 'commander';
import { generateCommand } from './commands/generate.js';
import { testCommand } from './commands/test.js';
import { installCommand } from './commands/install.js';
import { doctorCommand } from './commands/doctor.js';
import { listCommand } from './commands/list.js';

const program = new Command();

program
  .name('mcpeasy')
  .description('One command. Connected AI. Generate MCP servers for Claude in seconds.')
  .version('0.1.0-alpha');

program
  .command('generate')
  .description('Generate an MCP server from a data source')
  .requiredOption('--source <type>', 'Data source type (postgres, mysql, sqlite, mongodb, slack, stripe)')
  .option('--connection-string <url>', 'Database connection string')
  .option('--host <host>', 'Database host')
  .option('--port <port>', 'Database port')
  .option('--db <database>', 'Database name')
  .option('--user <user>', 'Database user')
  .option('--password <password>', 'Database password')
  .option('--file <path>', 'SQLite file path')
  .option('--token <token>', 'API token (for SaaS sources)')
  .option('--api-key <key>', 'API key (for SaaS sources)')
  .option('--output <dir>', 'Output directory (default: ./mcp-<source>-server)')
  .option('--read-only', 'Generate read-only tools (no insert/update/delete)')
  .option('--tables <tables>', 'Comma-separated list of tables to include')
  .option('--name <n>', 'Custom server name')
  .action(generateCommand);

program
  .command('test')
  .description('Test a generated MCP server locally')
  .argument('<dir>', 'Path to generated server directory')
  .option('--verbose', 'Show detailed output')
  .action(testCommand);

program
  .command('install')
  .description('Auto-configure a generated server in Claude Desktop')
  .argument('<dir>', 'Path to generated server directory')
  .option('--config <path>', 'Custom Claude Desktop config path')
  .action(installCommand);

program
  .command('doctor')
  .description('Check your environment for MCP readiness')
  .action(doctorCommand);

program
  .command('list')
  .description('List all available data source connectors')
  .action(listCommand);

program.parse();
