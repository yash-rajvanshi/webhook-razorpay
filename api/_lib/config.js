require('dotenv').config();

module.exports = {
  RAZORPAY_KEY_ID: process.env.RAZORPAY_KEY_ID || '',
  RAZORPAY_KEY_SECRET: process.env.RAZORPAY_KEY_SECRET || '',
  RAZORPAY_WEBHOOK_SECRET: process.env.RAZORPAY_WEBHOOK_SECRET || '',
  TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN || '',
  TELEGRAM_CHANNEL_ID: process.env.TELEGRAM_CHANNEL_ID || '',
  DOMAIN: process.env.DOMAIN || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : ''), // Auto-detects Vercel's generated URL
  MONGODB_URI: process.env.MONGODB_URI || '', // MongoDB Atlas Connection String
};
