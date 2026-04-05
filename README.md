# HMT Stock Alert: Premium Subscription System

An automated, serverless, and event-driven architecture that bridges a Telegram Bot, Razorpay, and MongoDB to seamlessly manage premium subscriptions for HMT Watch Stock Alerts.

## 🧱 Architecture Workflow

The system is deployed entirely on **Vercel Serverless Functions** mapped inside the `/api` directory for cost-efficient auto-scaling.

1. **User Initiation (`/start`)**
   - The Telegram bot replies with community links and an initial pitch to buy the Premium subscription (for high-demand watches like Kohinoor, Himalaya, etc.) for ₹99.

2. **Triggering Payment (`/buy` or Button Click)**
   - The Vercel function (`api/telegram-webhook.js`) communicates with Razorpay API.
   - It dynamically creates a Razorpay Payment Link carrying the user's `telegram_id`, `username`, and `first_name` securely inside the Razorpay `notes` payload.
   - The Bot responds to the user with the short URL.

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

---

## 🛠️ Technology Stack
- **Compute:** Vercel (Node.js Serverless Functions)
- **Database:** MongoDB Atlas + native Node.js MongoDB driver (connection cached to prevent cold-start exhaustion)
- **Bot Framework:** `telegraf`
- **Payment Gateway:** Razorpay Node.js SDK

## ⚙️ Environment Configuration

You must set up the following environment variables in your Vercel Dashboard or a local `.env` file to initialize the project:

```env
RAZORPAY_KEY_ID=your_razorpay_key_id
RAZORPAY_KEY_SECRET=your_razorpay_key_secret
RAZORPAY_WEBHOOK_SECRET=your_razorpay_webhook_secret
TELEGRAM_BOT_TOKEN=your_telegram_bot_token
TELEGRAM_CHANNEL_ID=your_telegram_channel_id
DOMAIN=https://your-vercel-project-name.vercel.app  # Optional: Fallbacks to system VERCEL_URL if empty
MONGODB_URI=mongodb+srv://<username>:<password>@cluster0.mongodb.net/your-db-name
```

## 🚀 Deployment & Webhook Registration

1. **Deploy to Vercel**
   - Push your code to a GitHub repository and link it to Vercel. 
   - Ensure the Environment Variables are correctly set inside the Vercel Dashboard.

2. **Bind Telegram to Vercel (Two-Step Process)**
   
   *Step A: Publish the Command Menu*
   - Visit the following URL in your browser to push the `/start`, `/buy`, `/help`, and `/status` commands to the Telegram UI:
   - `https://<YOUR-VERCEL-DOMAIN>.vercel.app/api/telegram-webhook?setWebhook=true`
   
   *Step B: Lock the Production Pointer (Crucial for Vercel)*
   - To prevent Vercel's "Preview Environments" from causing 401 Unauthorized errors by locking out Telegram, you **must** manually force the webhook back to your clean production URL. Visit this in your browser:
   - `https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook?url=https://<YOUR-VERCEL-DOMAIN>.vercel.app/api/telegram-webhook`

3. **Bind Razorpay to Vercel**
   - In Razorpay Dashboard -> Webhooks -> Add Webhook.
   - Set URL: `https://<YOUR-VERCEL-DOMAIN>.vercel.app/api/razorpay-webhook`
   - Set Secret: Matches `RAZORPAY_WEBHOOK_SECRET`
   - Set Active Event: `payment_link.paid`

## 🗄️ Database Structure

Documents in your MongoDB `users` collection look like this:
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
