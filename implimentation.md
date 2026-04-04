# 🧠 Instruction.md — Telegram Premium Access System (Razorpay + Vercel)

## 🎯 Objective

Build an automated system where:
- A user pays via Razorpay
- Payment is verified via webhook
- User receives a Telegram private channel invite link

The system must be **event-driven**, **secure**, and **serverless-compatible**.

---

## 🔁 Core Flow

User → /start bot  
      ↓  
Clicks “Buy Premium”  
      ↓  
Pays via Razorpay Payment Link  
      ↓  
Razorpay triggers webhook  
      ↓  
Backend verifies payment  
      ↓  
Generate Telegram invite link  
      ↓  
Send link to user via bot  

---

## 🧱 System Architecture

### 1. Telegram Bot Layer
- Handles user interaction
- Collects `telegram_id`
- Sends payment link
- Sends final invite link after payment

---

### 2. Payment Layer (Razorpay)
- Use Payment Links (not checkout)
- Attach `telegram_id` inside payment metadata (notes)
- Operates in:
  - Test mode (development)
  - Live mode (production)

---

### 3. Backend Layer (Serverless - Vercel)
- Exposes a public webhook endpoint
- Receives payment events from Razorpay
- Verifies webhook authenticity using signature
- Extracts user identity (`telegram_id`)
- Triggers Telegram bot actions

---

### 4. Access Control Layer (Telegram Channel)
- Private channel
- Bot must be admin
- Invite links are generated dynamically
- Each invite link should ideally be:
  - Single-use

---

## 🔐 Environment Configuration

All secrets must be stored in environment variables (never hardcoded):

- Razorpay API Key ID
- Razorpay API Secret
- Razorpay Webhook Secret
- Telegram Bot Token
- Telegram Channel ID

---

## ⚙️ Implementation Instructions (Step-by-Step)

### Step 1: Telegram Bot Setup
- Create a bot using BotFather
- Configure bot to respond to `/start`
- Ensure bot captures and stores `telegram_id`
- Provide a “Buy Premium” interaction trigger

---

### Step 2: Payment Link Integration
- When user clicks “Buy Premium”:
  - Generate a Razorpay Payment Link
  - Embed `telegram_id` in metadata (notes)
- Send payment link to user via Telegram

---

### Step 3: Webhook Setup
- Deploy backend on a public serverless platform (Vercel)
- Create a webhook endpoint
- Register this endpoint in Razorpay dashboard
- Subscribe to event:
  - `payment_link.paid`

---

### Step 4: Webhook Processing Logic
- Accept incoming POST request from Razorpay
- Validate signature using webhook secret
- Reject request if signature is invalid
- Parse event payload
- Extract:
  - payment status
  - `telegram_id` from metadata

---

### Step 5: Payment Validation Rules
- Only proceed if:
  - Event type is correct
  - Payment status is successful
- Ignore duplicate or failed events

---

### Step 6: Telegram Invite Link Generation
- Use Telegram Bot API to create invite link
- Ensure:
  - Bot has admin rights
  - Invite link is unique or limited

---

### Step 7: Send Access to User
- Send invite link to user via Telegram bot
- Message should confirm payment success

---

### Step 8: Error Handling
- Handle cases where:
  - Telegram API fails
  - Webhook retries occur
  - Invalid or missing metadata
- Ensure idempotency (avoid duplicate actions)

---

## 🧪 Testing Strategy

### Test Mode (Razorpay)
- Use test API keys
- Simulate successful and failed payments
- Verify webhook triggers correctly

### Validation Checks
- Webhook receives event
- Signature verification passes
- Invite link is generated
- User receives message

---

## 🚀 Production Deployment

### Step 1: Switch to Live Mode
- Replace test keys with live keys
- Reconfigure webhook in live mode

### Step 2: Real Payment Testing
- Perform small transaction
- Validate full flow end-to-end

---

## ⚠️ Constraints & Considerations

### Serverless Limitations
- No long-running processes
- All logic must execute quickly
- Avoid heavy computations in webhook

---

### Telegram Limitations
- User must initiate conversation with bot
- Bot cannot message users who haven’t started it
- Bot must be admin to generate invite links

---

### Security Requirements
- Always verify webhook signature
- Never trust client-side data
- Use environment variables for secrets

---

## 💡 Design Principles

- Event-driven architecture (no polling)
- Stateless backend (serverless friendly)
- Minimal dependencies (no DB required initially) - later we will save user data in DB.
- Scalable and production-ready

---

## 🔮 Future Enhancements

- Subscription expiry system
- Database for user tracking
- Automatic removal from channel
- Payment retries & recovery system
- Analytics dashboard

---

## ✅ End Goal

A fully automated pipeline:
- Payment → Verification → Access
- No manual intervention required
- Works reliably in production

---