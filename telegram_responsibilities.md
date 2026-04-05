# 🤖 Telegram Bot Responsibilities (Vercel Node)

This document clearly outlines exactly which Telegram API tasks and bot commands have been migrated to and are actively handled by this Vercel server. 

> [!IMPORTANT]
> You can safely remove any logic handling these specific commands, webhooks, or tasks from your *other* backend servers to prevent duplicate message responses.

---

## 1. Registered Commands Handled
This server intercepts and fully manages the following user commands:

- `/start`
  - Sends the welcome message with HMT channel links and the Premium prompt pitching the demanding watches.
  - Generates the inline `Buy Premium (₹99)` reply button.
  - Triggers a private funnel-tracking alert to the Admin (`ADMIN_CHAT_ID`) noting a new user started the bot.
- `/buy`
  - Invokes the Razorpay integration and dynamically generates the `₹99` URL.
  - Sends the generated payment link DM to the user in chat.
- `/status`
  - Validates the user's `telegram_id` instantly against MongoDB.
  - Replies with either a strict expiration rejection or a beautifully parsed active date.
- `/help`
  - Replies with a static markdown list of instructions explaining how to navigate the available workflows.

---

## 2. Inline Button Actions Handled
- `buy_premium`
  - This is the callback bound to the inline button seen frequently during `/start` or `/buy`. It silently acknowledges the callback query to remove the "loading circle" from the user's telegram UI, and creates the Razorpay link.

---

## 3. Background/Autonomous Telegram Tasks
This server is autonomously responsible for taking the following actions *without* the user explicitly typing commands:

1. **Channel Invite Link Generation**
   - Automatically uses the Telegram API to generate a `1 Member Limit, 24 Hour Expiration` invite link for your Premium Telegram Channel.
2. **Subscription Fulfillment DMs**
   - Automatically DMs the user with raw success strings containing their newly minted, single-use invite link.
3. **Admin Alerts (`/api/razorpay-webhook.js`)**
   - Automatically DMs the Admin user (`ADMIN_CHAT_ID`) a comprehensive breakdown whenever a user successfully lands a transaction (Name, Telegram ID, Payment ID, Expiry Extension data).

---

## 4. UI & Meta Configuration
- **Menu Array Management (`setMyCommands`)**
   - This server explicitly holds the authority over the native global Telegram UI Command Menu (the blue Menu button in the corner). If you attempt to use `setMyCommands` on another server, it will repeatedly override this Vercel server's button layout.
