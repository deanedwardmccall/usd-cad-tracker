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

## Usage

```bash
# Generate an MCP server from a Postgres database
mcpeasy generate --source postgres --connection-string postgresql://user:pass@localhost/mydb

# List available connectors
mcpeasy list

# Check your environment
mcpeasy doctor

# Install generated server into Claude Desktop
mcpeasy install ./mcp-postgres-server
```

## Supported Sources

| Source     | Status      |
|------------|-------------|
| PostgreSQL | ✅ Stable   |
| MySQL      | ⚠️ Beta     |
| SQLite     | ⚠️ Beta     |
| Slack      | ⚠️ Beta     |
| Stripe     | ⚠️ Beta     |

## How It Works

1. `mcpeasy generate` connects to your database
2. Introspects the full schema (tables, columns, relationships, row counts)
3. Generates a complete TypeScript MCP server project
4. You `npm install && npm run build` in the generated folder
5. Use `mcpeasy install` to wire it into Claude Desktop

## Entity

A [DigitalMass Inc.](https://digitalmass.ca) product — Dean Wilkins.

## License

MIT
