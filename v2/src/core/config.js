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
};

if (!config.botToken) {
  throw new Error('BOT_TOKEN is required');
}

module.exports = { config };
