// Centralized configuration with validation for required environment variables
// Loads env from .env via dotenv/config (ESM-friendly)
import 'dotenv/config';

/**
 * @typedef {Object} AppConfig
 * @property {string} MONGODB_URI
 * @property {string} JWT_SECRET
 * @property {number} PORT
 * @property {string} STRIPE_SECRET_KEY
 * @property {string} STRIPE_WEBHOOK_SECRET
 * @property {string} [ADMIN_EMAILS]
 * @property {string} [STRIPE_PRICE_PRO_MONTHLY]
 * @property {string} [STRIPE_PRICE_PRO_YEARLY]
 * @property {string} [STRIPE_PRICE_RESTORE_STREAK]
 * @property {string} [CORS_ORIGINS]
 * @property {string} [BILLING_SUCCESS_URL]
 * @property {string} [BILLING_CANCEL_URL]
 * @property {string} [SCHEDULER_ENABLED]
 */

const isDev = process.env.NODE_ENV !== 'production';

function required(name) {
  const value = process.env[name];
  if (!value || String(value).trim().length === 0) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

/** @type {AppConfig} */
export const config = {
  MONGODB_URI: required('MONGODB_URI'),
  JWT_SECRET: required('JWT_SECRET'),
  PORT: Number(required('PORT')),
  STRIPE_SECRET_KEY: required('STRIPE_SECRET_KEY'),
  STRIPE_WEBHOOK_SECRET: required('STRIPE_WEBHOOK_SECRET'),

  // Optional values with sensible development defaults
  ADMIN_EMAILS: process.env.ADMIN_EMAILS || '',
  STRIPE_PRICE_PRO_MONTHLY: process.env.STRIPE_PRICE_PRO_MONTHLY || '',
  STRIPE_PRICE_PRO_YEARLY: process.env.STRIPE_PRICE_PRO_YEARLY || '',
  STRIPE_PRICE_RESTORE_STREAK: process.env.STRIPE_PRICE_RESTORE_STREAK || '',
  CORS_ORIGINS: process.env.CORS_ORIGINS || (isDev ? 'http://localhost:4321' : ''),
  BILLING_SUCCESS_URL:
    process.env.BILLING_SUCCESS_URL || (isDev ? 'http://localhost:4321/dashboard?purchase=success' : ''),
  BILLING_CANCEL_URL:
    process.env.BILLING_CANCEL_URL || (isDev ? 'http://localhost:4321/pricing?purchase=cancelled' : ''),
  SCHEDULER_ENABLED: process.env.SCHEDULER_ENABLED ?? (isDev ? 'true' : 'false'),
};

export { isDev };
export default config;

