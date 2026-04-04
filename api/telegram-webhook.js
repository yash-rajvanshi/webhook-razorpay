const bot = require('./_lib/bot');
const razorpay = require('./_lib/razorpay');
const config = require('./_lib/config');

bot.start(async (ctx) => {
  const welcomeText = `⭐ If you want to get stock alerts for highly demanding watches i.e. "Kohinoor", "Himalaya", "Tareeq", "Sangam", and "Vijay", buy our Premium subscription at just ₹99!\n\n🔔Free Stock alerts are posted in this Channel:\nhttps://t.me/+qyxExKKw9oZhZmM1\nThis is the broadcasting channel where we share stock updates from hmtwatches.in and hmtwatches.store.\n\n💬 Want to chat with other HMT fans?\nJoin our community group:\nhttps://t.me/+n18fg9lCz344NjJl\n\nIt's our HMT Enjoyers Group where we discuss watches, share purchases, and help each other out. 😄`;

  await ctx.reply(welcomeText, {
    reply_markup: {
      inline_keyboard: [
        [{ text: "Buy Premium (₹99)", callback_data: "buy_premium" }]
      ]
    }
  });
});

bot.command('buy', async (ctx) => {
  const username = ctx.from.username || ctx.from.first_name || 'User';

  await ctx.reply(`Hello ${username}!\n\nClick the button below to join the HMT Stock Alert Pro Max channel for ₹99`, {
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

    await ctx.reply(`Here is your payment link. Once paid, you will automatically receive an invite link to join the HMT Stock Alert Pro Max channel here.\n\n${paymentLink.short_url}`);
  } catch (error) {
    console.error("Error creating payment link:", error);
    await ctx.reply("Sorry, there was an issue generating your payment link. Please try again later.");
  }
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
      await bot.telegram.setWebhook(webhookUrl);
      return res.status(200).send(`Telegram Webhook set to: ${webhookUrl}`);
    }
    
    res.status(200).send('Telegram Bot Webhook Endpoint is active. Use ?setWebhook=true to configure.');
  }
};
