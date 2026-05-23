# HMT Stock Alert: Premium Subscription System

An automated, serverless, and event-driven architecture that bridges a Telegram Bot, Razorpay, and MongoDB to seamlessly manage premium subscriptions for HMT Watch Stock Alerts.

## 🧱 Architecture Workflow

The system is deployed entirely on **Vercel Serverless Functions** mapped inside the `/api` directory for cost-efficient auto-scaling.

1. **User Initiation (`/start`)**
   - The Telegram bot replies with community links and an initial pitch to buy the Premium subscription (for high-demand watches like Kohinoor, Himalaya, etc.) for ₹99.
   - Admin is notified with the user's name, username, and Telegram ID.

2. **Triggering Payment (`/buy` or Button Click)**
   - The Vercel function (`api/telegram-webhook.js`) communicates with Razorpay API.
   - It dynamically creates a Razorpay Payment Link carrying the user's `telegram_id`, `username`, and `first_name` securely inside the Razorpay `notes` payload.
   - The Bot responds to the user with the short URL.
   - Admin is notified whenever a user triggers `/buy`.

3. **Payment Processing (Razorpay Webhook)**
   - Once the user successfully pays, Razorpay fires a `payment_link.paid` webhook event to the server (`api/razorpay-webhook.js`).
   - The backend cryptographically validates the `x-razorpay-signature` payload to prevent forged requests.

4. **Database Logic & Account Upgrades (MongoDB Atlas)**
   - The webhook connects to a cached MongoDB client.
   - If the user is new or expired: provisions an account set to expire exactly **30 days** from the transaction date.
   - If the user is an active subscriber extending their subscription: appends an extra 30 days onto their *existing* expiration date.

5. **Fulfillment (Invite Link generation)**
    - The bot generates a single-use, 24-hour expiring Telegram invite link to the Premium Channel.
    - The bot directly DMs the user notifying them of their success and providing their unique join link!

6. **Coupon System (`/redeem`)**
    - Users can redeem single-use coupon codes to get or extend their Premium subscription by a custom number of days (set at coupon creation, defaults to 30).
    - Admins can manage these coupons directly via Telegram commands.
    - Admin is notified whenever a coupon is redeemed, including the code, days granted, and new expiry date.

7. **Watch Catalog Search (`/search`)**
    - Users can search the full HMT watch catalog (721 watches) by name directly in the bot.
    - Results appear as tappable inline buttons (up to 15 matches). Tapping a watch sends its photo with the name as caption.
    - Search uses multi-term, case-insensitive regex (AND logic): e.g. `/search himalaya blue` matches only blue Himalaya variants.
    - A 1-second per-user debounce prevents rapid-fire spam.
    - Admin is notified with the search query and result count whenever a user triggers `/search`.

---

## 🛠️ Technology Stack
- **Compute:** Vercel (Node.js Serverless Functions)
- **Database:** MongoDB Atlas + native Node.js MongoDB driver (connection cached to prevent cold-start exhaustion)
- **Bot Framework:** `telegraf`
- **Payment Gateway:** Razorpay Node.js SDK
- **Watch Data:** `merged_watches.json` — 721 HMT watches, loaded once at cold start

## ⚙️ Environment Configuration

You must set up the following environment variables in your Vercel Dashboard or a local `.env` file to initialize the project:

```env
RAZORPAY_KEY_ID=your_razorpay_key_id
RAZORPAY_KEY_SECRET=your_razorpay_key_secret
RAZORPAY_WEBHOOK_SECRET=your_razorpay_webhook_secret
TELEGRAM_BOT_TOKEN=your_telegram_bot_token
TELEGRAM_CHANNEL_ID=your_telegram_channel_id
ADMIN_CHAT_ID=your_telegram_id_for_admin_commands
DOMAIN=https://your-vercel-project-name.vercel.app  # Optional: Fallbacks to system VERCEL_URL if empty
MONGODB_URI=mongodb+srv://<username>:<password>@cluster0.mongodb.net/your-db-name
```

## 🚀 Deployment & Webhook Registration

1. **Deploy to Vercel**
   - Push your code to a GitHub repository and link it to Vercel.
   - Ensure the Environment Variables are correctly set inside the Vercel Dashboard.

2. **Bind Telegram to Vercel (Two-Step Process)**

   *Step A: Publish the Command Menu*
   - Visit the following URL in your browser to push the `/start`, `/buy`, `/status`, `/redeem`, `/search`, and `/help` commands to the Telegram UI:
   - `https://<YOUR-VERCEL-DOMAIN>.vercel.app/api/telegram-webhook?setWebhook=true`

   *Step B: Lock the Production Pointer (Crucial for Vercel)*
   - To prevent Vercel's "Preview Environments" from causing 401 Unauthorized errors by locking out Telegram, you **must** manually force the webhook back to your clean production URL. Visit this in your browser:
   - `https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook?url=https://<YOUR-VERCEL-DOMAIN>.vercel.app/api/telegram-webhook`

3. **Bind Razorpay to Vercel**
   - In Razorpay Dashboard -> Webhooks -> Add Webhook.
   - Set URL: `https://<YOUR-VERCEL-DOMAIN>.vercel.app/api/razorpay-webhook`
   - Set Secret: Matches `RAZORPAY_WEBHOOK_SECRET`
   - Set Active Event: `payment_link.paid`

## 🔍 Watch Catalog Search

The bot includes a built-in search over the full HMT catalog (`merged_watches.json`, 721 watches).

### How it works
- **`/search`** (no arguments) — shows a usage prompt with examples.
- **`/search <query>`** — runs a case-insensitive, multi-term regex search (AND logic). All words in the query must appear in the watch name.
- Results appear as inline keyboard buttons (1 per row, up to 15). Tapping any sends the watch's photo with its full name as caption.
- A **1-second debounce** per user prevents spam.

### Examples
```
/search Kohinoor          → all Kohinoor variants
/search Himalaya Blue     → only blue Himalaya variants
/search XGSL 01           → all XGSL 01 models
```

## 🎟️ Coupon System

The bot includes a robust coupon system for manual subscription management or promotional offers. Each coupon can carry a custom duration (defaults to 30 days).

### User Commands
- `/redeem <CODE>`: Redeems a coupon code. The subscription is extended by the number of days set when the coupon was created.

### Admin Commands (Restricted to `ADMIN_CHAT_ID`)
- `/addcoupon CODE1,CODE2... [DAYS]`: Adds one or more unique coupon codes. Supports comma-separated bulk entry. Append an optional duration suffix (e.g. `15D`) to set custom days; defaults to 30 if omitted.
  ```
  /addcoupon HMT-FREE-001              → 30 days (default)
  /addcoupon HMT-FREE-001 15D          → 15 days
  /addcoupon CODE1,CODE2,CODE3 7D      → 7 days each
  ```
- `/listcoupons`: Displays all coupons in the database with their duration, status (Available/Used), and who redeemed them.
- `/unusedcoupons`: Lists only unused (available) coupons with their duration.

## 🔔 Admin Notifications

The admin (`ADMIN_CHAT_ID`) receives a Telegram message whenever a non-admin user triggers any of the following actions:

| Event | Emoji | Info Sent |
|---|---|---|
| `/start` | 🆕 | Name, username, Telegram ID |
| `/buy` | 🛒 | Name, username, Telegram ID |
| `/help` | ❓ | Name, username, Telegram ID |
| `/search` | 🔍 | Query, result count, name, username, Telegram ID |
| Coupon redeemed | 🎟️ | Code, days, name, username, Telegram ID, new expiry |

> Admin notifications are always skipped when the admin is using the bot themselves.

## 🗄️ Database Structure

### `users` collection:
```json
{
  "_id": "ObjectId(...)",
  "telegram_id": "123456789",
  "username": "yashrajvanshi",
  "first_name": "Yash",
  "status": "active",
  "lastPaymentDate": "2024-04-05T00:00:00.000Z",
  "expiresAt": "2024-05-05T00:00:00.000Z",
  "lastPaymentId": "plink_xyz123"
}
```

### `coupons` collection:
```json
{
  "_id": "ObjectId(...)",
  "code": "HMT-FREE-99",
  "days": 30,
  "used": false,
  "createdAt": "2024-04-05T00:00:00.000Z",
  "redeemedBy": null,
  "redeemedAt": null
}
```
