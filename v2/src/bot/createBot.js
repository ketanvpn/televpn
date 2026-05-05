const { Telegraf } = require('telegraf');
const { config } = require('../core/config');
const { logger } = require('../core/logger');
const { callbackRateLimit } = require('./middleware/callbackRateLimit');
const { registerBasicCommands } = require('./handlers/basicCommands');
const { registerMenuHandlers } = require('./handlers/menuHandlers');
const { pollPendingQrisPayments } = require('../services/qrisService');

function createBot({ db }) {
  const bot = new Telegraf(config.botToken);

  bot.use(callbackRateLimit());

  bot.use(async (ctx, next) => {
    try {
      return await next();
    } catch (err) {
      logger.error(`Bot handler error: ${err.message}`);
      try {
        await ctx.reply('Internal error. Please try again.');
      } catch (_) {}
      return null;
    }
  });

  registerBasicCommands(bot, db);
  registerMenuHandlers(bot, db);

  bot.command('ping', (ctx) => ctx.reply('pong'));

  setInterval(() => {
    pollPendingQrisPayments(db, bot).catch((err) => {
      logger.warn(`QRIS poll error: ${err.message}`);
    });
  }, Math.max(3000, Number(config.qrisPollIntervalMs || 7000)));

  return bot;
}

module.exports = { createBot };
