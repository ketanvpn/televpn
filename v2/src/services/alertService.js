const { config } = require('../core/config');
const { logger } = require('../core/logger');

const alertCache = new Map();

function buildAlertKey(scope, message) {
  return `${scope}:${String(message || '').slice(0, 160)}`;
}

async function sendAlert(bot, payload) {
  if (!config.alertChatId) return;

  const { scope = 'system', message = '-', dedupeMs = 30000 } = payload || {};
  const key = buildAlertKey(scope, message);
  const now = Date.now();
  const lastTs = Number(alertCache.get(key) || 0);
  if (now - lastTs < dedupeMs) return;
  alertCache.set(key, now);

  const text = [
    '<b>ALERT BOTVPN v2</b>',
    `Scope: <code>${scope}</code>`,
    `Time: <code>${new Date(now).toLocaleString('id-ID')}</code>`,
    `Message: <code>${String(message).replace(/</g, '&lt;').replace(/>/g, '&gt;')}</code>`,
  ].join('\n');

  try {
    await bot.telegram.sendMessage(config.alertChatId, text, { parse_mode: 'HTML' });
  } catch (err) {
    logger.warn(`Gagal kirim alert: ${err.message}`);
  }
}

module.exports = {
  sendAlert,
};
