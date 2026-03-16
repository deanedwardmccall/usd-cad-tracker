# LifeRhythm Intelligence Layer

A personal AI life-management system. You talk to it naturally ("I called for garbage tags Monday, remind me in 7-10 days if they don't arrive") and it logs, reminds, and briefs you via Telegram and email, backed by Google Sheets today and Postgres in the future.

---

## Architecture

```
You (Telegram / CLI)
        │
   bot.js / index.js          ← entry points
        │
   agent.js (LifeRhythmAgent) ← natural language → MCP tool calls (agentic loop)
        │
   liferhythm-mcp/            ← separate repo, spawned as a subprocess
        │
   Google Sheets              ← current data store
   Postgres (liferhythm-db)   ← standing by for future migration
```

### Key files

| File | Purpose |
|------|---------|
| `agent.js` | Core agent. Connects to MCP, agentic tool-call loop, date context resolution. Exports `LifeRhythmAgent` and `formatDateContext`. |
| `bot.js` | Telegram bot. Persistent service, cron-scheduled briefings, message routing. |
| `index.js` | CLI. Single-shot, interactive, and `--briefing` modes. |
| `mailer.js` | Email via Gmail app password or generic SMTP. Silently skips if not configured. |
| `docker-compose.yml` | `bot` + `db` (Postgres) services for Unraid deployment. |
| `Dockerfile` | `node:22-alpine`, production deps only, `bot.js` entrypoint. |
| `setup-unraid.sh` | One-shot deploy script for Unraid. Clone → `.env` → Docker Compose up. |
| `.env.example` | All env vars with explanations. Copy to `.env` and fill in. |

---

## Environment variables

All config is via `.env`. Copy `.env.example` → `.env`.

**Required to run:**
- `ANTHROPIC_API_KEY` — Anthropic API key
- `LIFERHYTHM_SHEET_ID` — Google Sheets ID (no fallback; must be set)
- `TELEGRAM_BOT_TOKEN` — from @BotFather
- `TELEGRAM_CHAT_ID` — your personal chat ID (send `/start` to the bot to get it)

**Google Sheets auth** (one of):
- `GOOGLE_APPLICATION_CREDENTIALS` — path to service account JSON
- `GOOGLE_SERVICE_ACCOUNT_EMAIL` + `GOOGLE_PRIVATE_KEY` — inline service account

**Optional:**
- `MCP_SERVER_PATH` — path to `liferhythm-mcp` (default: `~/liferhythm-mcp`)
- `EMAIL_FROM`, `EMAIL_TO`, `EMAIL_APP_PASSWORD` — Gmail notifications
- `SMTP_HOST/PORT/SECURE/USER/PASS` — generic SMTP (overrides Gmail config)
- `BRIEFING_CRON` — cron for morning briefing (default: `0 8 * * *`)
- `CHECKIN_CRON` — cron for evening check-in (default: `0 20 * * *`)
- `TIMEZONE` — cron timezone (default: `America/Toronto`)

**Postgres (not used by app yet — DB is ready, wiring is not):**
- `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`
- `DATABASE_URL` — will be used when migrating off Sheets

---

## Running locally

```bash
npm install

# Single message
node index.js "I called for garbage tags Monday, remind me in 7-10 days if they don't arrive"

# Interactive REPL
node index.js --interactive

# Morning briefing
node index.js --briefing

# Telegram bot (long-running)
node bot.js
```

## Running on Unraid (Docker)

```bash
# First time — run the setup script from your Mac:
ssh root@your-unraid-ip 'bash -s' < setup-unraid.sh

# After that, to update:
git -C /mnt/user/appdata/liferhythm pull
docker compose -f /mnt/user/appdata/liferhythm/liferhythm-agent/docker-compose.yml up -d --build

# Logs:
docker compose -f /mnt/user/appdata/liferhythm/liferhythm-agent/docker-compose.yml logs -f bot
```

The MCP server (`liferhythm-mcp`) must be cloned to `/mnt/user/appdata/liferhythm-mcp` on Unraid and is bind-mounted into the container at `/mcp` (read-only).

## Tests

```bash
npm test
```

Unit tests in `agent.test.js` cover `formatDateContext` and `LifeRhythmAgent` without any live connections. They run fast and have no external dependencies.

---

## The agentic loop (`agent.js`)

1. `connect()` — spawns the MCP subprocess, discovers its tools
2. `process(input)` — builds date context, sends to `claude-opus-4-6`, executes tool calls in a loop until `stop_reason === 'end_turn'` or `MAX_TURNS` (10) is hit
3. `disconnect()` — closes the MCP connection

The MCP subprocess receives a strict allowlist of env vars (never the full `process.env`). Tool results are fed back to Claude as `tool_result` blocks. The loop is bounded by `MAX_TURNS` to prevent runaway calls from prompt injection or model issues.

---

## Google Sheets → Postgres migration (future)

When you're ready:
1. Design the schema based on what's actually in the sheet after real use
2. Write new MCP tools that hit Postgres instead of Sheets
3. Uncomment `DATABASE_URL` in `.env`; the `liferhythm-db` container is already running

The Docker Compose stack already has Postgres running with a persistent volume. Connect with:
```bash
# From Unraid host
psql -h localhost -U liferhythm -d liferhythm
```

Do not migrate until you've used the system long enough to know what data you actually need. Schema designed after real use will be much better than schema designed upfront.

---

## Claude model

The agent uses `claude-opus-4-6`. If you want to change the model, edit the `model` field in `agent.js:process()`. Haiku is faster/cheaper for high-volume logging; Opus gives better natural language understanding for ambiguous inputs.

---

## Adding new capabilities

The agent discovers tools dynamically from the MCP server — you don't need to change `agent.js` to add new tools. Add the tool to `liferhythm-mcp`, restart the bot, and it will appear automatically.

To change what Claude does with those tools, edit the `SYSTEM_PROMPT` constant in `agent.js`.

---

## Secrets

- `.env` is gitignored — never commit it
- The MCP subprocess only receives an explicit allowlist of env vars from the parent process (see `agent.js:connect()`)
- The bot rejects messages from any Telegram chat ID other than `TELEGRAM_CHAT_ID`
- Postgres is bound to `127.0.0.1:5432` on the Unraid host — not exposed externally
