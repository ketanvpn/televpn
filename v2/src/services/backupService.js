const fs = require('fs');
const path = require('path');
const { config } = require('../core/config');
const { logger } = require('../core/logger');

function getBackupFiles() {
  const candidates = [
    path.resolve(config.dbPath),
  ];
  return candidates.filter((p) => fs.existsSync(p));
}

async function sendBackupNow(bot, reason = 'scheduled backup') {
  if (!config.backupChatId) {
    logger.warn('Backup chat id kosong, backup dilewati.');
    return;
  }

  const files = getBackupFiles();
  if (!files.length) {
    logger.warn('Tidak ada file database untuk backup.');
    return;
  }

  const ts = new Date().toLocaleString('id-ID');
  await bot.telegram.sendMessage(
    config.backupChatId,
    `Mulai backup v2\nWaktu: ${ts}\nAlasan: ${reason}`
  );

  for (const filePath of files) {
    try {
      const filename = path.basename(filePath);
      await bot.telegram.sendDocument(
        config.backupChatId,
        { source: filePath, filename },
        { caption: `Backup file: ${filename}` }
      );
    } catch (err) {
      logger.warn(`Gagal kirim backup ${filePath}: ${err.message}`);
    }
  }
}

function startBackupScheduler(bot) {
  if (!config.autoBackupEnabled) {
    logger.info('Auto backup nonaktif.');
    return null;
  }

  const intervalMs = Math.max(5, Number(config.autoBackupIntervalMin || 360)) * 60 * 1000;
  logger.info(`Auto backup aktif tiap ${Math.round(intervalMs / 60000)} menit.`);

  return setInterval(() => {
    sendBackupNow(bot, `interval ${Math.round(intervalMs / 60000)} menit`).catch((err) => {
      logger.warn(`Auto backup gagal: ${err.message}`);
    });
  }, intervalMs);
}

module.exports = {
  sendBackupNow,
  startBackupScheduler,
};
