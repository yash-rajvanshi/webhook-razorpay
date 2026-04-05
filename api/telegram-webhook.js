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
