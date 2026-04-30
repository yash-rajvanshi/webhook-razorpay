const bot = require('./_lib/bot');
const razorpay = require('./_lib/razorpay');
const config = require('./_lib/config');
const { getDb } = require('./_lib/db');

bot.start(async (ctx) => {
  const welcomeText = `⭐ If you want to get stock alerts for highly demanding watches i.e. "Kohinoor", "Himalaya", "Tareeq", "Sangam", and "Vijay", buy our Premium subscription at just ₹99 for 30 days!\n\n🔔Free Stock alerts are posted in this Channel:\nhttps://t.me/+qyxExKKw9oZhZmM1\nThis is the broadcasting channel where we share stock updates from hmtwatches.in and hmtwatches.store.\n\n💬 Want to chat with other HMT fans?\nJoin our community group:\nhttps://t.me/+n18fg9lCz344NjJl\n\nIt's our HMT Enjoyers Group where we discuss watches, share purchases, and help each other out. 😄`;

  await ctx.reply(welcomeText, {
    reply_markup: {
      inline_keyboard: [
        [{ text: "Buy Premium (₹99)", callback_data: "buy_premium" }]
      ]
    }
  });

  // Notify Admin (Skip if the Admin themselves is testing the bot)
  if (config.ADMIN_CHAT_ID && ctx.from.id.toString() !== config.ADMIN_CHAT_ID.toString()) {
    const adminMsg = `🆕 *New User Started the Bot!*\n\n*Name:* ${ctx.from.first_name || 'N/A'}\n*Username:* @${ctx.from.username || 'N/A'}\n*Telegram ID:* \`${ctx.from.id}\``;
    await bot.telegram.sendMessage(config.ADMIN_CHAT_ID, adminMsg, { parse_mode: 'Markdown' }).catch(e => console.error("Admin notification failed:", e));
  }
});

bot.command('buy', async (ctx) => {
  const username = ctx.from.username || ctx.from.first_name || 'User';

  await ctx.reply(`Hello ${username}!\n\nClick the button below to join the HMT Stock Alert Pro Max channel for ₹99/month (30 days).`, {
    reply_markup: {
      inline_keyboard: [
        [{ text: "Buy Premium", callback_data: "buy_premium" }]
      ]
    }
  });
});

bot.action('buy_premium', async (ctx) => {
  const telegram_id = ctx.from.id;

  try {
    // Acknowledge the callback query to remove loading state on button
    await ctx.answerCbQuery();
    await ctx.reply('Generating your secure payment link...');

    const paymentLink = await razorpay.paymentLink.create({
      amount: 99 * 100, // Amount in paise (99 INR)
      currency: "INR",
      accept_partial: false,
      description: "Premium Telegram Channel Access",
      customer: {
        name: ctx.from.first_name || "Telegram User",
      },
      notify: {
        sms: false,
        email: false
      },
      reminder_enable: false,
      notes: {
        telegram_id: telegram_id.toString(),
        username: ctx.from.username || "",
        first_name: ctx.from.first_name || ""
      }
    });

    await ctx.reply(`Here is your payment link for a 30-day Premium subscription. Once paid, you will automatically receive an invite link to join the HMT Stock Alert Pro Max channel here.\n\n${paymentLink.short_url}`);
  } catch (error) {
    console.error("Error creating payment link:", error);
    await ctx.reply("Sorry, there was an issue generating your payment link. Please try again later.");
  }
});

bot.command('status', async (ctx) => {
  const telegramId = ctx.from.id.toString();
  try {
    const db = await getDb();
    const usersColl = db.collection('users');
    const user = await usersColl.findOne({ telegram_id: telegramId });

    if (!user || !user.expiresAt) {
      return ctx.reply("❌ You do not have an active subscription.\n\nUse /buy to get Premium access!", {
        reply_markup: { inline_keyboard: [[{ text: "🛒 Buy Subscription (₹99 / 30 days)", callback_data: "buy_premium" }]] }
      });
    }

    const now = new Date();
    if (user.expiresAt < now) {
      return ctx.reply(`⚠️ Your Premium subscription expired on ${user.expiresAt.toDateString()}.\n\nUse /buy to renew your access!`, {
        reply_markup: { inline_keyboard: [[{ text: "🔄 Renew Subscription (₹99 / 30 days)", callback_data: "buy_premium" }]] }
      });
    }

    return ctx.reply(`✅ *Subscription Active*\n\nYour Premium access is valid until:\n📅 ${user.expiresAt.toDateString()}`, {
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: [[{ text: "⏩ Extend Subscription + 30 days", callback_data: "buy_premium" }]] }
    });
  } catch (err) {
    console.error("Status DB Error:", err);
    return ctx.reply("Sorry, we encountered an error while fetching your status. Please try again later.");
  }
});

// ─── Admin Command: /addcoupon ───────────────────────────────────────────────
bot.command('addcoupon', async (ctx) => {
  // Guard: Admin only
  if (ctx.from.id.toString() !== config.ADMIN_CHAT_ID.toString()) {
    return ctx.reply('❌ This command is restricted to the admin.');
  }

  const args = ctx.message.text.split(' ').slice(1);
  const couponCode = args[0];

  if (!couponCode) {
    return ctx.reply('⚠️ Usage: `/addcoupon YOUR-CODE`\n\nExample: `/addcoupon HMT-FREE-001`', { parse_mode: 'Markdown' });
  }

  try {
    const { addCoupon } = require('./_lib/coupon');
    const result = await addCoupon(couponCode);

    if (!result.success) {
      return ctx.reply(`❌ Coupon \`${couponCode.toUpperCase()}\` already exists.`, { parse_mode: 'Markdown' });
    }

    return ctx.reply(`✅ Coupon \`${couponCode.toUpperCase()}\` created successfully!\n\nShare it with a user — they can redeem it with:\n\`/redeem ${couponCode.toUpperCase()}\``, { parse_mode: 'Markdown' });
  } catch (err) {
    console.error('Add coupon error:', err);
    return ctx.reply('Sorry, something went wrong while creating the coupon. Please try again later.');
  }
});

// ─── Admin Command: /listcoupons ─────────────────────────────────────────────
bot.command('listcoupons', async (ctx) => {
  // Guard: Admin only
  if (ctx.from.id.toString() !== config.ADMIN_CHAT_ID.toString()) {
    return ctx.reply('❌ This command is restricted to the admin.');
  }

  try {
    const { listCoupons } = require('./_lib/coupon');
    const coupons = await listCoupons();

    if (coupons.length === 0) {
      return ctx.reply('📋 No coupons exist yet.\n\nCreate one with `/addcoupon YOUR-CODE`', { parse_mode: 'Markdown' });
    }

    let msg = '📋 *All Coupons:*\n\n';
    coupons.forEach((c, i) => {
      if (c.used) {
        msg += `${i + 1}. \`${c.code}\` — ✅ Used by \`${c.redeemedBy}\` on ${new Date(c.redeemedAt).toDateString()}\n`;
      } else {
        msg += `${i + 1}. \`${c.code}\` — 🟢 Available\n`;
      }
    });

    return ctx.reply(msg, { parse_mode: 'Markdown' });
  } catch (err) {
    console.error('List coupons error:', err);
    return ctx.reply('Sorry, something went wrong while fetching coupons. Please try again later.');
  }
});

// ─── User Command: /redeem ───────────────────────────────────────────────────
bot.command('redeem', async (ctx) => {
  const telegramId = ctx.from.id.toString();
  const args = ctx.message.text.split(' ').slice(1);
  const couponCode = args[0];

  if (!couponCode) {
    return ctx.reply('⚠️ Please provide a coupon code.\n\nUsage: `/redeem YOUR-COUPON-CODE`', { parse_mode: 'Markdown' });
  }

  try {
    const { redeemCoupon } = require('./_lib/coupon');
    const result = await redeemCoupon(couponCode, telegramId);

    if (!result.success) {
      if (result.reason === 'already_used') {
        return ctx.reply('❌ This coupon code has already been used.');
      }
      return ctx.reply('❌ Invalid coupon code. Please check and try again.');
    }

    // Coupon is valid — extend subscription by 30 days
    const db = await getDb();
    const usersColl = db.collection('users');
    const now = new Date();
    const existingUser = await usersColl.findOne({ telegram_id: telegramId });

    let newExpiry;
    if (existingUser && existingUser.expiresAt && existingUser.expiresAt > now) {
      // Active user — add 30 days to current expiry
      newExpiry = new Date(existingUser.expiresAt.getTime() + (30 * 24 * 60 * 60 * 1000));
    } else {
      // New or expired user — start 30 days from now
      newExpiry = new Date(now.getTime() + (30 * 24 * 60 * 60 * 1000));
    }

    await usersColl.updateOne(
      { telegram_id: telegramId },
      {
        $set: {
          telegram_id: telegramId,
          username: ctx.from.username || "",
          first_name: ctx.from.first_name || "",
          status: "active",
          expiresAt: newExpiry,
          warningSent: false
        }
      },
      { upsert: true }
    );

    // Send success message
    let successMsg;
    if (existingUser && existingUser.expiresAt && existingUser.expiresAt > now) {
      successMsg = `🎉 *Coupon Redeemed Successfully!*\n\nYour subscription has been extended by 30 days.\n📅 New expiry: *${newExpiry.toDateString()}*\n\nYou're already in the Premium Channel — enjoy! 🙌`;
    } else {
      // New/expired user — generate invite link
      const inviteLink = await bot.telegram.createChatInviteLink(config.TELEGRAM_CHANNEL_ID, {
        member_limit: 1,
        expire_date: Math.floor(Date.now() / 1000) + (60 * 60 * 24),
      });
      successMsg = `🎉 *Coupon Redeemed Successfully!*\n\n📅 Your 30-day Premium subscription is now active until *${newExpiry.toDateString()}*.\n\nHere is your invite link to the Premium Channel:\n${inviteLink.invite_link}\n\nPlease join within 24 hours.`;
    }

    await ctx.reply(successMsg, { parse_mode: 'Markdown' });

    // Admin notification
    if (config.ADMIN_CHAT_ID) {
      const adminMsg = `🎟️ *Coupon Redeemed!*\n\n*Code:* \`${couponCode.toUpperCase()}\`\n*Name:* ${ctx.from.first_name || 'N/A'}\n*Username:* @${ctx.from.username || 'N/A'}\n*Telegram ID:* \`${telegramId}\`\n*New Expiry:* ${newExpiry.toDateString()}`;
      await bot.telegram.sendMessage(config.ADMIN_CHAT_ID, adminMsg, { parse_mode: 'Markdown' })
        .catch(e => console.error('Admin coupon notification failed:', e));
    }

  } catch (err) {
    console.error('Coupon redeem error:', err);
    return ctx.reply('Sorry, something went wrong while redeeming your coupon. Please try again later.');
  }
});

bot.command('help', async (ctx) => {
  const helpText = `*HMT Stock Alert Bot 🕐*\n\n` +
    `*🆓 Free Channel* — Open to everyone!\n` +
    `Join here: https://t.me/+qyxExKKw9oZhZmM1\n` +
    `• Stock alerts from hmtwatches.in & hmtwatches.store\n` +
    `• All watch models covered except *Kohinoor, Himalaya, Tareeq, Sangam & Vijay*\n` +
    `• Alerts may be delayed compared to Premium\n\n` +
    `*⭐ Premium Channel* — Only ₹99 for 30 days\n` +
    `• 🚀 *Instant alerts* the moment stock goes live\n` +
    `• 🎯 Focused alerts for high-demand watches:\n` +
    `   *Kohinoor, Himalaya, Tareeq, Sangam & Vijay*\n` +
    `• ⚡ Get ahead of everyone — these sell out in minutes!\n` +
    `• 💬 Priority support in the community group\n\n` +
    `*📌 Commands*\n` +
    `/start - Welcome message & community links\n` +
    `/buy - Get the Premium payment link (₹99 / 30 days)\n` +
    `/status - Check when your Premium expires\n` +
    `/redeem - Redeem a coupon code (e.g. /redeem HMT-FREE-001)\n` +
    `/help - Show this guide\n\n` +
    `Each subscription lasts *30 days* from the date of payment.\n` +
    `Having trouble? Reach out in the community group! 😄`;
  return ctx.reply(helpText, {
    parse_mode: 'Markdown',
    disable_web_page_preview: true,
    reply_markup: {
      inline_keyboard: [
        [{ text: "Buy Premium (₹99 / 30 days)", callback_data: "buy_premium" }]
      ]
    }
  });
});

module.exports = async (req, res) => {
  if (req.method === 'POST') {
    try {
      console.log('📬 INCOMING TELEGRAM WEBHOOK:', req.body);
      
      // Process the Telegram update
      await bot.handleUpdate(req.body);
      
      console.log('✅ WEBHOOK PROCESSED SUCCESSFULLY');
      // Let Vercel know request succeeded
      return res.status(200).send('OK');
      // Let Vercel know request succeeded
      return res.status(200).send('OK');
    } catch (e) {
      console.error(e);
      // It's recommended to return 200 to Telegram even on errors so they don't get stuck retrying the same bad webhook
      return res.status(200).send('OK');
    }
  } else {
    // Allow setting the webhook via a GET request with query parameter
    if (req.query.setWebhook === 'true') {
      if (!config.DOMAIN) {
        return res.status(400).send('DOMAIN is not set in env variables');
      }
      const webhookUrl = `${config.DOMAIN}/api/telegram-webhook`;
      
      try {
        await bot.telegram.setMyCommands([
          { command: 'start', description: 'Start the bot and see community links' },
          { command: 'buy', description: 'Buy Premium Stock Alerts' },
          { command: 'status', description: 'Check your subscription status' },
          { command: 'redeem', description: 'Redeem a coupon code for 30 days' },
          { command: 'help', description: 'Show instructions and commands' }
        ]);
        await bot.telegram.setWebhook(webhookUrl);
        return res.status(200).send(`Telegram Webhook and Command Menu set to: ${webhookUrl}`);
      } catch (err) {
        console.error("Error setting webhook:", err);
        return res.status(500).send("Error setting up webhook features.");
      }
    }
    
    res.status(200).send('Telegram Bot Webhook Endpoint is active. Use ?setWebhook=true to configure.');
  }
};
