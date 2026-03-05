# mcpeasy

**One command. Connected AI. Generate MCP servers for Claude in seconds.**

```bash
mcpeasy generate --source postgres --connection-string postgresql://user:pass@localhost/mydb
# → Generates a complete, working MCP server in seconds
```

Think of it as "create-react-app" for AI-database connectivity.

## Install

```bash
npm install -g mcpeasy
```

## Quick Start

```bash
# PostgreSQL
mcpeasy generate --source postgres --connection-string postgresql://user:pass@localhost/mydb

# MySQL
mcpeasy generate --source mysql --connection-string mysql://user:pass@localhost/mydb

# SQLite
mcpeasy generate --source sqlite --file ./my-database.sqlite

# Slack workspace
mcpeasy generate --source slack --token xoxb-your-bot-token

# Stripe account
mcpeasy generate --source stripe --api-key sk_test_your-key
```

## All Commands

```bash
mcpeasy generate   # Generate an MCP server from a data source
mcpeasy list       # List all available connectors
mcpeasy doctor     # Check your environment for MCP readiness
mcpeasy install    # Auto-configure a generated server in Claude Desktop
mcpeasy test       # Test a generated server locally
```

## Supported Sources

| Source     | Status    | Auth                          |
|------------|-----------|-------------------------------|
| PostgreSQL | ✅ Stable | `--connection-string` or `--db` |
| MySQL      | ✅ Stable | `--connection-string` or `--db` |
| SQLite     | ✅ Stable | `--file <path>`               |
| Slack      | ✅ Stable | `--token xoxb-...`            |
| Stripe     | ✅ Stable | `--api-key sk_...`            |

Coming soon: MongoDB, Jira, HubSpot, GitHub, Linear, Airtable, Google Sheets

## How It Works

1. `mcpeasy generate` connects to your data source
2. Introspects the full schema (tables, columns, relationships, row counts)
3. Generates a complete TypeScript MCP server project
4. `cd` into the output folder → `npm install && npm run build`
5. Use `mcpeasy install` to wire it into Claude Desktop

## Generated Server

Each generated server includes:
- `list_tables` — show all tables with column counts and row estimates
- `query_<table>` — SELECT with optional WHERE, ORDER BY, LIMIT
- `describe_<table>` — full column schema with types, PKs, FKs
- `insert_<table>` — parameterized INSERT (omit with `--read-only`)

## Options

```
--source      postgres | mysql | sqlite | slack | stripe  (required)
--connection-string  Full database URL
--host / --port / --db / --user / --password  Individual params
--file        Path to SQLite file
--token       API token (Slack)
--api-key     API key (Stripe)
--output      Output directory (default: ./mcp-<source>-server)
--name        Custom server name
--read-only   Omit insert/update/delete tools
--tables      Comma-separated list of tables to include
```

## Development

```bash
npm install
npm run build     # tsc → dist/
npm run test:run  # vitest run
npm run lint      # tsc --noEmit
```

## Entity

A [DigitalMass Inc.](https://digitalmass.ca) product — Dean Wilkins.

## License

MIT
