// ============================================
// Competitor Price Tracker — Shared Config
// Central configuration. Do NOT modify without
// Lead Agent approval.
// ============================================

import path from 'path';

export const CONFIG = {
  // Server
  PORT: parseInt(process.env.PORT || '3000', 10),
  NODE_ENV: process.env.NODE_ENV || 'development',

  // Database
  DB_PATH: path.join(__dirname, '..', 'data', 'tracker.db'),

  // Scraper
  SCRAPER_TIMEOUT_MS: parseInt(process.env.SCRAPER_TIMEOUT_MS || '30000', 10),
  SCRAPER_HEADLESS: process.env.SCRAPER_HEADLESS !== 'false',

  // Notifications - Email (Resend)
  RESEND_API_KEY: process.env.RESEND_API_KEY || '',
  NOTIFICATION_FROM_EMAIL: process.env.NOTIFICATION_FROM_EMAIL || 'alerts@competitor-tracker.com',
  NOTIFICATION_TO_EMAIL: process.env.NOTIFICATION_TO_EMAIL || '',

  // Notifications - Telegram (optional)
  TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN || '',
  TELEGRAM_CHAT_ID: process.env.TELEGRAM_CHAT_ID || '',

  // Defaults
  DEFAULT_CHECK_INTERVAL: 24 as const,
  DEFAULT_CURRENCY: 'EUR',
  DEFAULT_NOTIFICATION_METHOD: 'email' as const,

  // Security
  API_KEY: process.env.API_KEY || '',
  ALLOWED_ORIGIN: process.env.ALLOWED_ORIGIN || '',

  // Rate Limiting
  MIN_CHECK_INTERVAL_MINUTES: 60,
  MAX_PRODUCTS: 100,
  MAX_CONCURRENT_SCRAPES: 3,
} as const;
