const { Telegraf } = require('telegraf');
const { config } = require('../core/config');
const { logger } = require('../core/logger');
const { callbackRateLimit } = require('./middleware/callbackRateLimit');
const { registerBasicCommands } = require('./handlers/basicCommands');
const { registerMenuHandlers } = require('./handlers/menuHandlers');
const { pollPendingQrisPayments } = require('../services/qrisService');
const { startBackupScheduler } = require('../services/backupService');
const { startDailyReportScheduler } = require('../services/dailyReportService');
const { sendAlert } = require('../services/alertService');
const { getSetting } = require('../repositories/settingsRepository');
const { getUserById } = require('../repositories/userRepository');
const { getEffectiveRole, canAccessAdmin } = require('../services/roleService');

function createBot({ db }) {
  const bot = new Telegraf(config.botToken);

  bot.use(callbackRateLimit());

  bot.use(async (ctx, next) => {
    const maintenanceFlag = await getSetting(db, 'maintenance_enabled');
    const isMaintenance = String(maintenanceFlag || 'false').toLowerCase() === 'true';
    if (!isMaintenance) return next();

    const userId = Number(ctx.from?.id || 0);
    if (!userId) return next();

    const userRow = await getUserById(db, userId);
    const role = getEffectiveRole(userId, userRow ? userRow.role : 'member');
    if (canAccessAdmin(role)) return next();

    if (ctx.callbackQuery) {
      try {
        await ctx.answerCbQuery('Bot sedang maintenance. Coba lagi nanti.', { show_alert: true });
      } catch (_) {}
      return null;
    }

    try {
      await ctx.reply('⚠️ Bot sedang maintenance. Silakan coba lagi beberapa saat.');
    } catch (_) {}
    return null;
  });

  bot.use(async (ctx, next) => {
    try {
      return await next();
    } catch (err) {
      logger.error(`Bot handler error: ${err.message}`);
      sendAlert(bot, { scope: 'bot-handler', message: err.message }).catch(() => null);
      try {
        await ctx.reply('❌ Terjadi gangguan sementara. Silakan coba lagi beberapa saat.');
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

  startBackupScheduler(bot);
  startDailyReportScheduler(bot, db);

  process.on('unhandledRejection', (reason) => {
    const msg = reason && reason.message ? reason.message : String(reason);
    logger.error(`UnhandledRejection: ${msg}`);
    sendAlert(bot, { scope: 'unhandledRejection', message: msg, dedupeMs: 60000 }).catch(() => null);
  });

  process.on('uncaughtException', (err) => {
    const msg = err && err.message ? err.message : String(err);
    logger.error(`UncaughtException: ${msg}`);
    sendAlert(bot, { scope: 'uncaughtException', message: msg, dedupeMs: 60000 }).catch(() => null);
  });

  return bot;
}

module.exports = { createBot };
