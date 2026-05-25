const bot = require('./_lib/bot');
const razorpay = require('./_lib/razorpay');
const config = require('./_lib/config');
const { getDb } = require('./_lib/db');
const { rateLimit } = require('./_lib/rateLimiter');
const watches = require('../merged_watches.json'); // 721 HMT watches, loaded once at cold start

// ─── Watch Search Helpers ────────────────────────────────────────────────────

/**
 * Returns watches whose name matches ALL search terms (case-insensitive).
 * Each word in the query is a separate regex — AND logic.
 * e.g. "himalaya blue" matches "HMT Himalaya AGGL 01 Blue" but not "HMT Himalaya AGGL 01 Yellow"
 */
function searchWatches(query) {
  const terms = query.trim().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return [];
  const regexes = terms.map(t => new RegExp(t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'));
  return watches.filter(w => regexes.every(re => re.test(w.name)));
}

// Per-user rate limiting is handled globally by api/_lib/rateLimiter.js (2-second cooldown).

// Items shown per page (14 watch buttons + optional nav row = max 15 rows)
const PAGE_SIZE = 14;

/**
 * Builds the message text and inline keyboard for a given page of search results.
 * Nav row: [<<< PREV]  [NEXT >>>] shown only when applicable, in a single row.
 * callback_data format for pagination: "sp:<page>:<query>" (max 64 bytes total).
 */
function buildSearchPage(results, query, page) {
  const totalPages = Math.ceil(results.length / PAGE_SIZE);
  const pageResults = results.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  // One watch button per row
  const keyboard = pageResults.map(w => ([{ text: w.name, callback_data: `watch_${w.id}` }]));

  // Navigation row (only shown when there are multiple pages)
  if (totalPages > 1) {
    const navRow = [];
    if (page > 0) {
      navRow.push({ text: '<<< PREV', callback_data: `sp:${page - 1}:${query}` });
    }
    if (page < totalPages - 1) {
      navRow.push({ text: 'NEXT >>>', callback_data: `sp:${page + 1}:${query}` });
    }
    if (navRow.length > 0) keyboard.push(navRow);
  }

  const pageLabel = totalPages > 1 ? ` — page ${page + 1}/${totalPages}` : '';
  const msg =
    `🔍 Found *${results.length}* watch${results.length !== 1 ? 'es' : ''} for *"${query}"*${pageLabel}:`;

  return { msg, keyboard };
}

bot.start(async (ctx) => {
  if (!rateLimit(ctx.from.id)) {
    return ctx.reply('⏳ Please wait a moment before sending another command.');
  }

  const welcomeText = `⭐ If you want to get stock alerts for highly demanding watches i.e. "Kohinoor", "Himalaya", "Tareeq", "Sangam", and "Vijay", buy our Premium subscription at just ₹99 for 30 days!\n\n🔔Free Stock alerts are posted in this Channel:\nhttps://t.me/+qyxExKKw9oZhZmM1\nThis is the broadcasting channel where we share stock updates from hmtwatches.in and hmtwatches.store.\n\n💬 Want to chat with other HMT fans?\nJoin our community group:\nhttps://t.me/+n18fg9lCz344NjJl\n\nIt's our HMT Enjoyers Group where we discuss watches, share purchases, and help each other out. 😄`;

  await ctx.reply(welcomeText, {
    reply_markup: {
      inline_keyboard: [
        [{ text: "Buy Premium (₹99)", callback_data: "buy_premium" }],
        [{ text: "🎁 Try Free (3 days)", callback_data: "start_trial" }]
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
  if (!rateLimit(ctx.from.id)) {
    return ctx.reply('⏳ Please wait a moment before sending another command.');
  }

  const username = ctx.from.username || ctx.from.first_name || 'User';

  await ctx.reply(`Hello ${username}!\n\nClick the button below to join the HMT Stock Alert Pro Max channel for ₹99/month (30 days).`, {
    reply_markup: {
      inline_keyboard: [
        [{ text: "Buy Premium", callback_data: "buy_premium" }]
      ]
    }
  });

  // Notify Admin (Skip if the Admin themselves is testing the bot)
  if (config.ADMIN_CHAT_ID && ctx.from.id.toString() !== config.ADMIN_CHAT_ID.toString()) {
    const adminMsg = `🛒 *User Triggered /buy*\n\n*Name:* ${ctx.from.first_name || 'N/A'}\n*Username:* @${ctx.from.username || 'N/A'}\n*Telegram ID:* \`${ctx.from.id}\``;
    await bot.telegram.sendMessage(config.ADMIN_CHAT_ID, adminMsg, { parse_mode: 'Markdown' }).catch(e => console.error("Admin notification failed:", e));
  }
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
  if (!rateLimit(ctx.from.id)) {
    return ctx.reply('⏳ Please wait a moment before sending another command.');
  }

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

  const parts = ctx.message.text.split(' ').slice(1);

  if (parts.length === 0 || !parts[0].trim()) {
    return ctx.reply('⚠️ Usage: `/addcoupon CODE1,CODE2,CODE3 [DAYS]`\n\nExamples:\n`/addcoupon HMT-FREE-001` _(30 days default)_\n`/addcoupon HMT-FREE-001 15D` _(15 days)_\n`/addcoupon HMT-FREE-001,HMT-FREE-002 7D`', { parse_mode: 'Markdown' });
  }

  // Check if the last argument is a duration like 15D, 7D, 90D etc.
  let days = 30;
  let codesPart = parts.join(' ');
  const lastArg = parts[parts.length - 1].toUpperCase();
  const durationMatch = lastArg.match(/^(\d+)D$/);
  if (durationMatch && parts.length > 1) {
    days = parseInt(durationMatch[1], 10);
    if (days < 1 || days > 365) {
      return ctx.reply('⚠️ Duration must be between 1D and 365D.');
    }
    // Remove the duration part from the codes string
    codesPart = parts.slice(0, -1).join(' ');
  }

  // Split by commas, trim whitespace, filter empty strings
  const codes = codesPart.split(',').map(c => c.trim()).filter(c => c.length > 0);

  if (codes.length === 0) {
    return ctx.reply('⚠️ No valid coupon codes provided.');
  }

  try {
    const { addCoupon } = require('./_lib/coupon');
    const result = await addCoupon(codes, days);

    let msg = '';

    if (result.created.length > 0) {
      msg += `✅ *Created ${result.created.length} coupon(s) — ${days} day(s) each:*\n`;
      result.created.forEach(c => { msg += `  • \`${c}\`\n`; });
    }

    if (result.duplicates.length > 0) {
      if (msg) msg += '\n';
      msg += `⚠️ *${result.duplicates.length} already existed (skipped):*\n`;
      result.duplicates.forEach(c => { msg += `  • \`${c}\`\n`; });
    }

    if (result.created.length === 1) {
      msg += `\nShare with a user: \`/redeem ${result.created[0]}\``;
    }

    return ctx.reply(msg, { parse_mode: 'Markdown' });
  } catch (err) {
    console.error('Add coupon error:', err);
    return ctx.reply('Sorry, something went wrong while creating the coupon(s). Please try again later.');
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
      const daysLabel = `${c.days || 30}D`;
      if (c.used) {
        msg += `${i + 1}. \`${c.code}\` (${daysLabel}) — ✅ Used by \`${c.redeemedBy}\` on ${new Date(c.redeemedAt).toDateString()}\n`;
      } else {
        msg += `${i + 1}. \`${c.code}\` (${daysLabel}) — 🟢 Available\n`;
      }
    });

    return ctx.reply(msg, { parse_mode: 'Markdown' });
  } catch (err) {
    console.error('List coupons error:', err);
    return ctx.reply('Sorry, something went wrong while fetching coupons. Please try again later.');
  }
});

// ─── Admin Command: /unusedcoupons ───────────────────────────────────────────
bot.command('unusedcoupons', async (ctx) => {
  // Guard: Admin only
  if (ctx.from.id.toString() !== config.ADMIN_CHAT_ID.toString()) {
    return ctx.reply('❌ This command is restricted to the admin.');
  }

  try {
    const { listUnusedCoupons } = require('./_lib/coupon');
    const coupons = await listUnusedCoupons();

    if (coupons.length === 0) {
      return ctx.reply('📋 No unused coupons available.\n\nCreate one with `/addcoupon YOUR-CODE`', { parse_mode: 'Markdown' });
    }

    let msg = `🟢 *Unused Coupons (${coupons.length}):*\n\n`;
    coupons.forEach((c, i) => {
      const daysLabel = `${c.days || 30}D`;
      msg += `${i + 1}. \`${c.code}\` (${daysLabel})\n`;
    });

    return ctx.reply(msg, { parse_mode: 'Markdown' });
  } catch (err) {
    console.error('Unused coupons error:', err);
    return ctx.reply('Sorry, something went wrong while fetching unused coupons. Please try again later.');
  }
});

// ─── User Command: /redeem ───────────────────────────────────────────────────
bot.command('redeem', async (ctx) => {
  if (!rateLimit(ctx.from.id)) {
    return ctx.reply('⏳ Please wait a moment before sending another command.');
  }

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

    // Coupon is valid — extend subscription by the coupon's day count
    const couponDays = result.coupon.days || 30;
    const db = await getDb();
    const usersColl = db.collection('users');
    const now = new Date();
    const existingUser = await usersColl.findOne({ telegram_id: telegramId });

    let newExpiry;
    if (existingUser && existingUser.expiresAt && existingUser.expiresAt > now) {
      // Active user — add coupon days to current expiry
      newExpiry = new Date(existingUser.expiresAt.getTime() + (couponDays * 24 * 60 * 60 * 1000));
    } else {
      // New or expired user — start coupon days from now
      newExpiry = new Date(now.getTime() + (couponDays * 24 * 60 * 60 * 1000));
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
      successMsg = `🎉 *Coupon Redeemed Successfully!*\n\nYour subscription has been extended by ${couponDays} day(s).\n📅 New expiry: *${newExpiry.toDateString()}*\n\nYou're already in the Premium Channel — enjoy! 🙌`;
    } else {
      // New/expired user — generate invite link
      const inviteLink = await bot.telegram.createChatInviteLink(config.TELEGRAM_CHANNEL_ID, {
        member_limit: 1,
        expire_date: Math.floor(Date.now() / 1000) + (60 * 60 * 24),
      });
      successMsg = `🎉 *Coupon Redeemed Successfully!*\n\n📅 Your ${couponDays}-day Premium subscription is now active until *${newExpiry.toDateString()}*.\n\nHere is your invite link to the Premium Channel:\n${inviteLink.invite_link}\n\nPlease join within 24 hours.`;
    }

    await ctx.reply(successMsg, { parse_mode: 'Markdown' });

    // Admin notification
    if (config.ADMIN_CHAT_ID) {
      const adminMsg = `🎟️ *Coupon Redeemed!*\n\n*Code:* \`${couponCode.toUpperCase()}\`\n*Days:* ${couponDays}\n*Name:* ${ctx.from.first_name || 'N/A'}\n*Username:* @${ctx.from.username || 'N/A'}\n*Telegram ID:* \`${telegramId}\`\n*New Expiry:* ${newExpiry.toDateString()}`;
      await bot.telegram.sendMessage(config.ADMIN_CHAT_ID, adminMsg, { parse_mode: 'Markdown' })
        .catch(e => console.error('Admin coupon notification failed:', e));
    }

  } catch (err) {
    console.error('Coupon redeem error:', err);
    return ctx.reply('Sorry, something went wrong while redeeming your coupon. Please try again later.');
  }
});

bot.command('help', async (ctx) => {
  if (!rateLimit(ctx.from.id)) {
    return ctx.reply('⏳ Please wait a moment before sending another command.');
  }

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
    `/trial - Start a free 3-day Premium trial (one-time)\n` +
    `/price - See current Premium pricing\n` +
    `/status - Check when your Premium expires\n` +
    `/redeem - Redeem a coupon code (e.g. /redeem HMT-FREE-001)\n` +
    `/search - Search the HMT watch catalog by name\n` +
    `/help - Show this guide\n\n` +
    `Each subscription lasts *30 days* from the date of payment.\n` +
    `Having trouble? Reach out in the community group! 😄`;

  await ctx.reply(helpText, {
    parse_mode: 'Markdown',
    disable_web_page_preview: true,
    reply_markup: {
      inline_keyboard: [
        [{ text: "Buy Premium (₹99 / 30 days)", callback_data: "buy_premium" }],
        [{ text: "🎁 Try Free (3 days)", callback_data: "start_trial" }]
      ]
    }
  });

  // Notify Admin (Skip if the Admin themselves is testing the bot)
  if (config.ADMIN_CHAT_ID && ctx.from.id.toString() !== config.ADMIN_CHAT_ID.toString()) {
    const adminMsg = `❓ *User Triggered /help*\n\n*Name:* ${ctx.from.first_name || 'N/A'}\n*Username:* @${ctx.from.username || 'N/A'}\n*Telegram ID:* \`${ctx.from.id}\``;
    await bot.telegram.sendMessage(config.ADMIN_CHAT_ID, adminMsg, { parse_mode: 'Markdown' }).catch(e => console.error("Admin notification failed:", e));
  }
});

// ─── User Command: /price ─────────────────────────────────────────────────────
bot.command('price', async (ctx) => {
  if (!rateLimit(ctx.from.id)) {
    return ctx.reply('⏳ Please wait a moment before sending another command.');
  }

  const priceText =
    `💰 *HMT Stock Alert Premium Pricing*\n\n` +
    `📦 *Premium Plan*\n` +
    `• Price: *₹99*\n` +
    `• Duration: *30 days*\n` +
    `• Instant stock alerts for Kohinoor, Himalaya, Tareeq, Sangam & Vijay\n` +
    `• Alerts the moment stock goes live — before everyone else!\n\n` +
    `🎁 *Free Trial*\n` +
    `• Try Premium free for *3 days* with /trial\n` +
    `• No payment required — one trial per user\n\n` +
    `Ready to subscribe? Tap below! 👇`;

  await ctx.reply(priceText, {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [{ text: "🛒 Buy Premium (₹99 / 30 days)", callback_data: "buy_premium" }],
        [{ text: "🎁 Try Free (3 days)", callback_data: "start_trial" }]
      ]
    }
  });
});

// ─── Trial Helper ─────────────────────────────────────────────────────────────
/**
 * Core logic for activating a free 3-day trial.
 * Called by both the /trial command and the start_trial button callback.
 * @param {import('telegraf').Context} ctx
 */
async function activateTrial(ctx) {
  const telegramId = ctx.from.id.toString();

  try {
    const db = await getDb();
    const usersColl = db.collection('users');
    const existingUser = await usersColl.findOne({ telegram_id: telegramId });

    // Guard 1: Already used trial
    if (existingUser && existingUser.trialUsed) {
      return ctx.reply(
        '❌ You have already used your free trial.\n\nUse /buy to get Premium access!',
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: "🛒 Buy Premium (₹99 / 30 days)", callback_data: "buy_premium" }]
            ]
          }
        }
      );
    }

    // Guard 2: Already has an active paid subscription
    const now = new Date();
    if (existingUser && existingUser.expiresAt && existingUser.expiresAt > now) {
      return ctx.reply(
        `✅ You already have an active subscription until *${existingUser.expiresAt.toDateString()}*. No trial needed!`,
        { parse_mode: 'Markdown' }
      );
    }

    // Activate 3-day trial
    const TRIAL_DAYS = 3;
    const trialExpiry = new Date(now.getTime() + (TRIAL_DAYS * 24 * 60 * 60 * 1000));

    await usersColl.updateOne(
      { telegram_id: telegramId },
      {
        $set: {
          telegram_id: telegramId,
          username: ctx.from.username || "",
          first_name: ctx.from.first_name || "",
          status: "active",
          expiresAt: trialExpiry,
          trialUsed: true,
          warningSent: false
        }
      },
      { upsert: true }
    );

    // Generate single-use invite link (24hr expiry)
    const inviteLink = await bot.telegram.createChatInviteLink(
      config.TELEGRAM_CHANNEL_ID,
      {
        member_limit: 1,
        expire_date: Math.floor(Date.now() / 1000) + (60 * 60 * 24),
      }
    );

    const successMsg =
      `🎁 *Free Trial Activated!*\n\n` +
      `Your 3-day Premium trial is now active until *${trialExpiry.toDateString()}*.\n\n` +
      `Here is your invite link to the Premium Channel:\n${inviteLink.invite_link}\n\n` +
      `Please join within 24 hours.\n\n` +
      `_Enjoying Premium? Use /buy to continue after your trial ends!_ 😊`;

    await ctx.reply(successMsg, { parse_mode: 'Markdown' });

    // Admin notification
    if (config.ADMIN_CHAT_ID && ctx.from.id.toString() !== config.ADMIN_CHAT_ID.toString()) {
      const adminMsg =
        `🎁 *Free Trial Activated!*\n\n` +
        `*Name:* ${ctx.from.first_name || 'N/A'}\n` +
        `*Username:* @${ctx.from.username || 'N/A'}\n` +
        `*Telegram ID:* \`${telegramId}\`\n` +
        `*Trial Expiry:* ${trialExpiry.toDateString()}`;
      await bot.telegram.sendMessage(config.ADMIN_CHAT_ID, adminMsg, { parse_mode: 'Markdown' })
        .catch(e => console.error('Admin trial notification failed:', e));
    }

  } catch (err) {
    console.error('Trial activation error:', err);
    return ctx.reply('Sorry, something went wrong while activating your trial. Please try again later.');
  }
}

// ─── User Command: /trial ─────────────────────────────────────────────────────
bot.command('trial', async (ctx) => {
  if (!rateLimit(ctx.from.id)) {
    return ctx.reply('⏳ Please wait a moment before sending another command.');
  }
  return activateTrial(ctx);
});

// ─── Callback: Start Trial via Button ────────────────────────────────────────
bot.action('start_trial', async (ctx) => {
  await ctx.answerCbQuery();
  return activateTrial(ctx);
});

// ─── User Command: /search ───────────────────────────────────────────────────
bot.command('search', async (ctx) => {
  if (!rateLimit(ctx.from.id)) {
    return ctx.reply('⏳ Please wait a moment before searching again.');
  }

  // ── Parse the search query from the message ──
  const query = ctx.message.text.split(' ').slice(1).join(' ').trim();

  if (!query) {
    // No argument — show usage prompt
    return ctx.reply(
      '🔍 *Search the HMT Watch Catalog*\n\n' +
      'Send your query after the command:\n' +
      '`/search Kohinoor`\n' +
      '`/search Himalaya Blue`\n' +
      '`/search XGSL 01`\n\n' +
      '_Tip: You can combine multiple words — all must match the watch name._',
      { parse_mode: 'Markdown' }
    );
  }

  // ── Run regex search ──
  const results = searchWatches(query);

  if (results.length === 0) {
    return ctx.reply(
      `❌ No watches found for *"${query}"*\n\nTry a different keyword like \`Kohinoor\`, \`Himalaya\`, or \`XGSL\`.`,
      { parse_mode: 'Markdown' }
    );
  }

  // Build page 0 and send
  const { msg, keyboard } = buildSearchPage(results, query, 0);
  await ctx.reply(msg, {
    parse_mode: 'Markdown',
    reply_markup: { inline_keyboard: keyboard }
  });

  // ── Admin notification (skip if admin is testing) ──
  if (config.ADMIN_CHAT_ID && ctx.from.id.toString() !== config.ADMIN_CHAT_ID.toString()) {
    const adminMsg =
      `🔍 *User Triggered /search*\n\n` +
      `*Query:* \`${query}\`\n` +
      `*Results:* ${results.length}\n` +
      `*Name:* ${ctx.from.first_name || 'N/A'}\n` +
      `*Username:* @${ctx.from.username || 'N/A'}\n` +
      `*Telegram ID:* \`${ctx.from.id}\``;
    await bot.telegram.sendMessage(config.ADMIN_CHAT_ID, adminMsg, { parse_mode: 'Markdown' })
      .catch(e => console.error('Admin notification failed:', e));
  }
});

// ─── Callback: Search Pagination (PREV / NEXT) ───────────────────────────────
// callback_data format: "sp:<page>:<query>"  (max 64 bytes — safe for short queries)
bot.action(/^sp:(\d+):(.+)$/, async (ctx) => {
  const page = parseInt(ctx.match[1], 10);
  const query = ctx.match[2];

  await ctx.answerCbQuery();

  const results = searchWatches(query);
  if (results.length === 0) {
    return ctx.editMessageText('❌ No results found for that query anymore.');
  }

  const { msg, keyboard } = buildSearchPage(results, query, page);
  await ctx.editMessageText(msg, {
    parse_mode: 'Markdown',
    reply_markup: { inline_keyboard: keyboard }
  });
});

// ─── Callback: Watch Photo Display ───────────────────────────────────────────
bot.action(/^watch_(\d+)$/, async (ctx) => {
  const watchId = parseInt(ctx.match[1], 10);
  const watch = watches.find(w => w.id === watchId);

  await ctx.answerCbQuery();

  if (!watch) {
    return ctx.reply('❌ Watch not found. It may have been removed from the catalog.');
  }

  await ctx.replyWithPhoto(watch.url, {
    caption: `🕐 *${watch.name}*`,
    parse_mode: 'Markdown'
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
          { command: 'buy', description: 'Buy Premium Stock Alerts (₹99 / 30 days)' },
          { command: 'trial', description: 'Start a free 3-day Premium trial' },
          { command: 'price', description: 'See current Premium pricing' },
          { command: 'status', description: 'Check your subscription status' },
          { command: 'redeem', description: 'Redeem a coupon code' },
          { command: 'search', description: 'Search the HMT watch catalog by name' },
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
