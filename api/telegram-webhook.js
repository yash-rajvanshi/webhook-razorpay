const bot = require('./_lib/bot');
const razorpay = require('./_lib/razorpay');
const config = require('./_lib/config');

bot.start(async (ctx) => {
  const username = ctx.from.username || ctx.from.first_name || 'User';

  await ctx.reply(`Hello ${username}! Welcome to Premium Access.\n\nClick the button below to buy premium for 500 INR.`, {
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
      amount: 500 * 100, // Amount in paise (500 INR)
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
        telegram_id: telegram_id.toString()
      }
    });

    await ctx.reply(`Here is your payment link. Once paid, you will automatically receive an invite link here.\n\n${paymentLink.short_url}`);
  } catch (error) {
    console.error("Error creating payment link:", error);
    await ctx.reply("Sorry, there was an issue generating your payment link. Please try again later.");
  }
});

module.exports = async (req, res) => {
  if (req.method === 'POST') {
    try {
      await bot.handleUpdate(req.body, res);
    } catch (e) {
      console.error(e);
      res.status(500).send('Something went wrong');
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
