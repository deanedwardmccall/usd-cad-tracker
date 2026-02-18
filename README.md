# usd-cad-tracker
Easy to view financial data for viewing on my phone

## Getting Started (Mac)

### 1. Clone the repo
```bash
git clone https://github.com/deanedwardmccall/usd-cad-tracker.git ~/usd-cad-tracker
cd ~/usd-cad-tracker
```

### 2. Run the USD/CAD tracker
No install needed — just start the server:
```bash
npm start
```
Then open **http://localhost:3000** in your browser.

---

## LifeRhythm Agent

The `liferhythm-agent/` folder contains a natural language AI layer that reads/writes your Google Sheet via MCP.

### Setup
```bash
cd liferhythm-agent
npm install
cp .env.example .env
```

Edit `.env` and fill in:
- `ANTHROPIC_API_KEY` — from console.anthropic.com
- `LIFERHYTHM_SHEET_ID` — already pre-filled with your sheet
- `GOOGLE_APPLICATION_CREDENTIALS` — path to your service account JSON

### Run
```bash
# Interactive chat mode
npm run chat

# Single command
node index.js "Paid hydro bill today"
```

> **Prerequisite:** The MCP server must be running at `~/liferhythm-mcp/`. See the MCP server repo for setup.
