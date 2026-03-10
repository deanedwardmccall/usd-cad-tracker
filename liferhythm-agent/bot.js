#!/usr/bin/env node
/**
 * LifeRhythm Telegram Bot
 *
 * Runs as a persistent service providing:
 *   - Real-time chat: text the bot anytime to log tasks, events, or reminders
 *   - Morning briefing: daily summary of what's due, overdue, and upcoming
 *   - Evening check-in: daily prompt to log anything you forgot
 *   - Email alongside Telegram for both scheduled notifications
 *
 * First-time setup:
 *   1. Message @BotFather on Telegram → /newbot → copy the token
 *   2. Set TELEGRAM_BOT_TOKEN in .env
 *   3. node bot.js — then send /start to your bot to get your Chat ID
 *   4. Set TELEGRAM_CHAT_ID in .env and restart
 *
 * Commands:
 *   /start     — Get your Chat ID (needed for initial setup)
 *   /briefing  — Run morning briefing right now
 *   /checkin   — Trigger the evening check-in prompt
 *   (any text) — Log it via the LifeRhythm agent
 *
 * Run it:
 *   node bot.js
 *
 * Keep it running in the background:
 *   nohup node bot.js >> logs/bot.log 2>&1 &
 *   # or use pm2: pm2 start bot.js --name liferhythm
 */

import TelegramBot from 'node-telegram-bot-api';
import cron from 'node-cron';
import { config } from 'dotenv';
import { LifeRhythmAgent } from './agent.js';
import { sendEmail } from './mailer.js';

config();

// ─── Config ───────────────────────────────────────────────────────────────────

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const TIMEZONE = process.env.TIMEZONE || 'America/Toronto';

// Cron expressions (default: 8am briefing, 8pm check-in)
// Override in .env: BRIEFING_CRON="0 7 * * *" for 7am, etc.
const BRIEFING_CRON = process.env.BRIEFING_CRON || '0 8 * * *';
const CHECKIN_CRON = process.env.CHECKIN_CRON || '0 20 * * *';

if (!BOT_TOKEN) {
  console.error('Error: TELEGRAM_BOT_TOKEN is required. See .env.example for setup instructions.');
  process.exit(1);
}

const bot = new TelegramBot(BOT_TOKEN, { polling: true });

// ─── Agent helper ─────────────────────────────────────────────────────────────

/**
 * Run a natural language query through the LifeRhythm agent.
 * Opens a fresh MCP connection each call — reliable for a personal-scale tool.
 *
 * @param {string} input - Natural language input
 * @returns {Promise<string>} - Agent's response
 */
async function runAgent(input) {
  const agent = new LifeRhythmAgent();
  await agent.connect();
  try {
    const { response } = await agent.process(input);
    return response;
  } finally {
    await agent.disconnect();
  }
}

// ─── Scheduled jobs ───────────────────────────────────────────────────────────

/**
 * Morning briefing: ask the agent what's due today, overdue, and upcoming.
 * Sends to Telegram and email (if configured).
 */
async function runBriefing() {
  console.log(`[${new Date().toISOString()}] Running morning briefing...`);

  const response = await runAgent(
    'Give me my morning briefing. Please check for: ' +
    '(1) any items with reminders due today or that are past due, ' +
    '(2) anything scheduled for today, ' +
    '(3) anything coming up in the next 7 days. ' +
    'Format this as a friendly, scannable morning briefing with clear sections. ' +
    'If nothing is pending, say so briefly.'
  );

  if (CHAT_ID) {
    await bot.sendMessage(CHAT_ID, `*Morning Briefing*\n\n${response}`, {
      parse_mode: 'Markdown',
    });
  }

  await sendEmail('LifeRhythm — Morning Briefing', response);
  console.log(`[${new Date().toISOString()}] Briefing sent.`);
}

/**
 * Evening check-in: prompt the user to log anything they forgot today.
 * Just sends the prompt — user replies via Telegram and it routes to the agent.
 */
async function runCheckin() {
  console.log(`[${new Date().toISOString()}] Sending evening check-in...`);

  const message =
    '*Evening Check-In*\n\n' +
    "What got done today that needs logging? Any calls made, tasks completed, " +
    "errands run, appointments kept, or reminders you want to set?\n\n" +
    "Just reply here and I'll log it for you.";

  if (CHAT_ID) {
    await bot.sendMessage(CHAT_ID, message, { parse_mode: 'Markdown' });
  }

  await sendEmail(
    'LifeRhythm — Evening Check-In',
    "What got done today that needs logging?\n\n" +
    "Any calls made, tasks completed, errands run, appointments kept, " +
    "or reminders you want to set?\n\n" +
    "Reply to your LifeRhythm Telegram bot to log anything."
  );

  console.log(`[${new Date().toISOString()}] Check-in sent.`);
}

// ─── Message handler ──────────────────────────────────────────────────────────

bot.on('message', async msg => {
  const chatId = msg.chat.id;
  const text = msg.text?.trim();
  if (!text) return;

  // /start: always respond — reveals Chat ID so user can configure .env
  if (text === '/start') {
    await bot.sendMessage(
      chatId,
      `Welcome to LifeRhythm!\n\nYour Chat ID is:\n\`${chatId}\`\n\n` +
      `Add this to your .env file:\n\`TELEGRAM_CHAT_ID=${chatId}\`\n\n` +
      `Then restart the bot. After that, just text me anything to log it.`,
      { parse_mode: 'Markdown' }
    );
    return;
  }

  // Reject messages from unknown senders
  // (protects against other Telegram users stumbling on your bot token)
  if (CHAT_ID && String(chatId) !== String(CHAT_ID)) {
    await bot.sendMessage(chatId, 'Unauthorized. Send /start to get your Chat ID.');
    return;
  }

  // /briefing: run now on demand
  if (text === '/briefing') {
    const typingInterval = setInterval(() => bot.sendChatAction(chatId, 'typing'), 4000);
    await bot.sendChatAction(chatId, 'typing');
    try {
      await runBriefing();
    } catch (err) {
      console.error('[briefing] Error:', err.message);
      await bot.sendMessage(chatId, `Briefing failed: ${err.message}`);
    } finally {
      clearInterval(typingInterval);
    }
    return;
  }

  // /checkin: trigger check-in prompt on demand
  if (text === '/checkin') {
    await runCheckin().catch(err => bot.sendMessage(chatId, `Check-in failed: ${err.message}`));
    return;
  }

  // Any other text → process through the agent
  const typingInterval = setInterval(() => bot.sendChatAction(chatId, 'typing'), 4000);
  await bot.sendChatAction(chatId, 'typing');
  try {
    const response = await runAgent(text);
    clearInterval(typingInterval);
    await bot.sendMessage(chatId, response);
  } catch (err) {
    clearInterval(typingInterval);
    console.error(`[${new Date().toISOString()}] Agent error:`, err.message);
    await bot.sendMessage(chatId, `Something went wrong: ${err.message}`);
  }
});

bot.on('polling_error', err => {
  console.error(`[${new Date().toISOString()}] Polling error:`, err.message);
});

// ─── Schedule ─────────────────────────────────────────────────────────────────

cron.schedule(BRIEFING_CRON, () => {
  runBriefing().catch(err => console.error('[briefing] Scheduled error:', err.message));
}, { timezone: TIMEZONE });

cron.schedule(CHECKIN_CRON, () => {
  runCheckin().catch(err => console.error('[check-in] Scheduled error:', err.message));
}, { timezone: TIMEZONE });

// ─── Startup ──────────────────────────────────────────────────────────────────

console.log('LifeRhythm bot is running.');
console.log(`  Timezone:        ${TIMEZONE}`);
console.log(`  Morning briefing: ${BRIEFING_CRON}`);
console.log(`  Evening check-in: ${CHECKIN_CRON}`);
if (!CHAT_ID) {
  console.log('  Note: TELEGRAM_CHAT_ID not set. Send /start to the bot to get your ID.');
}
