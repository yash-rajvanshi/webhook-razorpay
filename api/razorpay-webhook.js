const crypto = require('crypto');
const configLib = require('./_lib/config');
const bot = require('./_lib/bot');
const Razorpay = require('razorpay');
const { getDb } = require('./_lib/db');

const getRawBody = (req) => {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
};

const handler = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed');
  }

  try {
    const rawBody = await getRawBody(req);
    const signature = req.headers['x-razorpay-signature'];
    
    // Validate signature via Razorpay helper
    try {
      const isValid = Razorpay.validateWebhookSignature(rawBody, signature, configLib.RAZORPAY_WEBHOOK_SECRET);
      if (!isValid) {
         return res.status(400).send('Invalid Signature');
      }
    } catch (err) {
       console.error("Signature verification error:", err);
       return res.status(400).send('Signature Verification Failed');
    }

    const event = JSON.parse(rawBody);

    if (event.event === 'payment_link.paid') {
      const paymentLink = event.payload.payment_link.entity;
      const notes = paymentLink.notes;

      if (notes && notes.telegram_id) {
        const telegramId = notes.telegram_id;

        try {
          // Generate a single-use invite link valid for 24 hours
          const inviteLink = await bot.telegram.createChatInviteLink(configLib.TELEGRAM_CHANNEL_ID, {
            member_limit: 1, 
            expire_date: Math.floor(Date.now() / 1000) + (60 * 60 * 24),
          });

          const db = await getDb();
          const usersColl = db.collection('users');
          const now = new Date();
          
          const existingUser = await usersColl.findOne({ telegram_id: telegramId.toString() });
          
          let newExpiry;
          let isExtension = false;
          
          if (existingUser && existingUser.expiresAt && existingUser.expiresAt > now) {
            // Extend from current expiry
            newExpiry = new Date(existingUser.expiresAt.getTime() + (30 * 24 * 60 * 60 * 1000));
            isExtension = true;
          } else {
            // Start 30 days from now
            newExpiry = new Date(now.getTime() + (30 * 24 * 60 * 60 * 1000));
          }
          
          await usersColl.updateOne(
            { telegram_id: telegramId.toString() },
            { 
              $set: { 
                telegram_id: telegramId.toString(),
                username: notes.username || "",
                first_name: notes.first_name || "",
                status: "active",
                lastPaymentDate: now,
                expiresAt: newExpiry,
                lastPaymentId: paymentLink.id,
                warningSent: false // Reset so the warning can fire again on the next cycle
              } 
            },
            { upsert: true }
          );

          let successMessage = `🎉 Payment Successful!✅ Thanks for subscribing.`;
          if (isExtension) {
            successMessage = `🎉 Payment Successful!✅ Your subscription has been extended to ${newExpiry.toDateString()}.`;
          }
          
          successMessage += `\n\nHere is your single-use invite link to the Premium Channel:\n\n${inviteLink.invite_link}\n\nPlease join within 24 hours.`;

          await bot.telegram.sendMessage(telegramId, successMessage);

          if (configLib.ADMIN_CHAT_ID) {
            const adminMsg = `🤑 *New Subscription Payment!*\n\n*Name:* ${notes.first_name || 'N/A'}\n*Username:* @${notes.username || 'N/A'}\n*Telegram ID:* \`${telegramId}\`\n*Action:* ${isExtension ? 'Extension' : 'New Subscription'}\n*Expiry Date:* ${newExpiry.toDateString()}\n*Payment ID:* \`${paymentLink.id}\``;
            await bot.telegram.sendMessage(configLib.ADMIN_CHAT_ID, adminMsg, { parse_mode: 'Markdown' }).catch(e => console.error("Admin notification failed:", e));
          }

        } catch (botError) {
          console.error("Failed to generate or send invite link:", botError);
        }
      } else {
        console.warn('No telegram_id found in notes', notes);
      }
    }

    res.status(200).json({ status: 'ok' });
  } catch (error) {
    console.error("Webhook processing error:", error);
    res.status(500).send('Internal Server Error');
  }
};

module.exports = handler;
module.exports.config = {
  api: {
    bodyParser: false,
  },
};
