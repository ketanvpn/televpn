function parseAdminIds(value) {
  return String(value || '')
    .split(',')
    .map((v) => Number(v.trim()))
    .filter((n) => Number.isFinite(n) && n > 0);
}

const config = {
  botToken: String(process.env.BOT_TOKEN || '').trim(),
  masterId: Number(process.env.MASTER_ID || 0),
  adminIds: parseAdminIds(process.env.ADMIN_IDS),
  dbPath: String(process.env.DB_PATH || './data/botvpn-v2.db'),
  logLevel: String(process.env.LOG_LEVEL || 'info').toLowerCase(),
  gopayApiKey: String(process.env.GOPAY_API_KEY || '').trim(),
  gopayApiBaseUrl: String(process.env.GOPAY_API_BASE_URL || 'https://api-gopay.autoftbot.com').trim(),
  qrisPollIntervalMs: Number(process.env.QRIS_POLL_INTERVAL_MS || 7000),
};

if (!config.botToken) {
  throw new Error('BOT_TOKEN is required');
}

module.exports = { config };
