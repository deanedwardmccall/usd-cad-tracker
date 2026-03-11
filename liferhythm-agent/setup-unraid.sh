#!/bin/bash
# LifeRhythm — Unraid one-shot setup script
# Run this on your Unraid box:
#   bash setup-unraid.sh
# Or from your Mac in one line:
#   ssh root@your-unraid-ip 'bash -s' < setup-unraid.sh

set -euo pipefail

# ─── Config — edit these before running ───────────────────────────────────────
REPO_URL="https://github.com/deanedwardmccall/usd-cad-tracker.git"
BRANCH="claude/liferhythm-intelligence-layer-6w0bJ"
INSTALL_DIR="/mnt/user/appdata/liferhythm"
MCP_REPO_URL=""   # Set this to your liferhythm-mcp repo URL, or leave blank
                  # to skip (you can clone it manually later)
# ──────────────────────────────────────────────────────────────────────────────

AGENT_DIR="$INSTALL_DIR/liferhythm-agent"
MCP_DIR="/mnt/user/appdata/liferhythm-mcp"

echo ""
echo "=== LifeRhythm Unraid Setup ==="
echo ""

# ── 1. Check Docker is available ──────────────────────────────────────────────
if ! command -v docker &>/dev/null; then
  echo "ERROR: Docker not found. Install the Docker plugin from the Unraid Community Apps store first."
  exit 1
fi
if ! docker compose version &>/dev/null; then
  echo "ERROR: 'docker compose' (v2) not found. Update Docker or install the Compose plugin."
  exit 1
fi
echo "[1/6] Docker OK ($(docker --version))"

# ── 2. Clone / update the main repo ───────────────────────────────────────────
if [ -d "$INSTALL_DIR/.git" ]; then
  echo "[2/6] Repo exists — pulling latest..."
  git -C "$INSTALL_DIR" fetch origin "$BRANCH"
  git -C "$INSTALL_DIR" checkout "$BRANCH"
  git -C "$INSTALL_DIR" pull origin "$BRANCH"
else
  echo "[2/6] Cloning repo to $INSTALL_DIR ..."
  git clone --branch "$BRANCH" "$REPO_URL" "$INSTALL_DIR"
fi

# ── 3. Clone the MCP server (optional) ────────────────────────────────────────
if [ -n "$MCP_REPO_URL" ]; then
  if [ -d "$MCP_DIR/.git" ]; then
    echo "[3/6] MCP server exists — pulling latest..."
    git -C "$MCP_DIR" pull
  else
    echo "[3/6] Cloning MCP server to $MCP_DIR ..."
    git clone "$MCP_REPO_URL" "$MCP_DIR"
  fi
else
  echo "[3/6] MCP_REPO_URL not set — skipping MCP clone."
  echo "      Clone it manually to $MCP_DIR before starting the bot."
fi

# ── 4. Create .env if it doesn't exist ────────────────────────────────────────
if [ -f "$AGENT_DIR/.env" ]; then
  echo "[4/6] .env already exists — skipping (not overwriting your secrets)."
else
  echo "[4/6] Creating .env from .env.example ..."
  cp "$AGENT_DIR/.env.example" "$AGENT_DIR/.env"
  echo ""
  echo "  *** ACTION REQUIRED ***"
  echo "  Fill in your secrets in: $AGENT_DIR/.env"
  echo "  At minimum you need:"
  echo "    ANTHROPIC_API_KEY"
  echo "    LIFERHYTHM_SHEET_ID"
  echo "    TELEGRAM_BOT_TOKEN"
  echo "    TELEGRAM_CHAT_ID"
  echo "    POSTGRES_PASSWORD  (anything strong, e.g. \$(openssl rand -hex 16))"
  echo ""
  echo "  Run this to edit it now:"
  echo "    nano $AGENT_DIR/.env"
  echo ""
  read -rp "  Press Enter when you're done filling in .env, or Ctrl+C to exit and do it later... "
fi

# ── 5. Validate required vars are non-empty ────────────────────────────────────
echo "[5/6] Checking required .env values..."
MISSING=()
check_var() {
  local val
  val=$(grep -E "^$1=" "$AGENT_DIR/.env" | cut -d= -f2- | tr -d '[:space:]')
  [ -z "$val" ] && MISSING+=("$1")
}
check_var ANTHROPIC_API_KEY
check_var TELEGRAM_BOT_TOKEN
check_var TELEGRAM_CHAT_ID
check_var POSTGRES_PASSWORD

if [ ${#MISSING[@]} -gt 0 ]; then
  echo ""
  echo "  ERROR: The following required values are missing in .env:"
  for v in "${MISSING[@]}"; do echo "    - $v"; done
  echo ""
  echo "  Edit $AGENT_DIR/.env and run this script again."
  exit 1
fi
echo "      All required vars set."

# ── 6. Build and start containers ─────────────────────────────────────────────
echo "[6/6] Building and starting containers..."
cd "$AGENT_DIR"
docker compose pull db          # pull postgres image
docker compose build bot        # build app image
docker compose up -d

echo ""
echo "=== Done! ==="
echo ""
echo "Check status:      docker compose -f $AGENT_DIR/docker-compose.yml ps"
echo "Watch bot logs:    docker compose -f $AGENT_DIR/docker-compose.yml logs -f bot"
echo "Stop everything:   docker compose -f $AGENT_DIR/docker-compose.yml down"
echo "Update and restart:"
echo "  git -C $INSTALL_DIR pull && docker compose -f $AGENT_DIR/docker-compose.yml up -d --build"
echo ""
echo "Send your bot a message on Telegram to confirm it's working."
