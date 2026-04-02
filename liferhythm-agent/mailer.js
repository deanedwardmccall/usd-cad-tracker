/**
 * LifeRhythm Email Notifications
 *
 * Sends email via Gmail (app password) or any SMTP server.
 * Silently skips if email env vars are not configured, so Telegram-only
 * setups work without any email config.
 *
 * Gmail setup:
 *   1. Enable 2-Step Verification on your Google account
 *   2. Generate an App Password at myaccount.google.com/apppasswords
 *   3. Set EMAIL_FROM, EMAIL_TO, and EMAIL_APP_PASSWORD in .env
 *
 * Generic SMTP (e.g. Outlook, custom server):
 *   Set SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS,
 *   EMAIL_FROM, and EMAIL_TO in .env
 */

import nodemailer from 'nodemailer';

function createTransport() {
  if (process.env.SMTP_HOST) {
    // Generic SMTP — works with Outlook, Fastmail, custom servers, etc.
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  // Gmail with App Password (simplest for most people)
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_FROM,
      pass: process.env.EMAIL_APP_PASSWORD,
    },
  });
}

/**
 * Send an email notification.
 * Silently skips if EMAIL_FROM or EMAIL_TO is not set.
 *
 * @param {string} subject
 * @param {string} body - Plain text body
 */
export async function sendEmail(subject, body) {
  const from = process.env.EMAIL_FROM;
  const to = process.env.EMAIL_TO;
  if (!from || !to) return;

  const transport = createTransport();
  await transport.sendMail({ from, to, subject, text: body });
}
