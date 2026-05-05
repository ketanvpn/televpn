const { config } = require('../core/config');
const { logger } = require('../core/logger');

let lastReportDateKey = null;

function getDateKey(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

async function collectDailyStats(db) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  const startTs = start.getTime();
  const endTs = end.getTime();

  const [newUsers, createdAccounts, topupTotal, pendingQris] = await Promise.all([
    db.get('SELECT COUNT(*) AS total FROM users WHERE created_at >= ? AND created_at < ?', [startTs, endTs]),
    db.get('SELECT COUNT(*) AS total FROM accounts WHERE created_at >= ? AND created_at < ?', [startTs, endTs]),
    db.get("SELECT COALESCE(SUM(amount),0) AS total FROM transactions WHERE type IN ('qris_topup','manual_addsaldo') AND created_at >= ? AND created_at < ?", [startTs, endTs]),
    db.get("SELECT COUNT(*) AS total FROM qris_payments WHERE status = 'pending'"),
  ]);

  return {
    newUsers: Number(newUsers?.total || 0),
    createdAccounts: Number(createdAccounts?.total || 0),
    topupTotal: Number(topupTotal?.total || 0),
    pendingQris: Number(pendingQris?.total || 0),
  };
}

async function sendDailyReport(bot, db, reason = 'scheduled') {
  if (!config.backupChatId) return;

  const stats = await collectDailyStats(db);
  const text = [
    '<b>Laporan Harian BOTVPN v2</b>',
    `Tanggal: <code>${getDateKey()}</code>`,
    `Mode: <code>${reason}</code>`,
    '',
    `User baru: <b>${stats.newUsers}</b>`,
    `Akun dibuat: <b>${stats.createdAccounts}</b>`,
    `Topup masuk: <b>Rp${stats.topupTotal.toLocaleString('id-ID')}</b>`,
    `Pending QRIS: <b>${stats.pendingQris}</b>`,
  ].join('\n');

  await bot.telegram.sendMessage(config.backupChatId, text, { parse_mode: 'HTML' });
}

function startDailyReportScheduler(bot, db) {
  if (!config.dailyReportEnabled) {
    logger.info('Daily report nonaktif.');
    return null;
  }

  return setInterval(() => {
    const now = new Date();
    const hour = now.getHours();
    const minute = now.getMinutes();
    const dateKey = getDateKey(now);

    if (hour === Number(config.dailyReportHour) && minute === Number(config.dailyReportMinute)) {
      if (lastReportDateKey === dateKey) return;
      lastReportDateKey = dateKey;
      sendDailyReport(bot, db, 'scheduled').catch((err) => {
        logger.warn(`Daily report gagal: ${err.message}`);
      });
    }
  }, 30 * 1000);
}

module.exports = {
  sendDailyReport,
  startDailyReportScheduler,
};
