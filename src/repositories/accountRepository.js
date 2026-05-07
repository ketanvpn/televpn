const { getOne, getAll, run } = require('./sqliteRepo');

async function getTotalAccounts(db) {
  const row = await getOne(db, 'SELECT COUNT(*) AS count FROM accounts', []);
  return row ? row.count : 0;
}

async function getTotalActiveAccounts(db, nowTs) {
  const row = await getOne(
    db,
    'SELECT COUNT(*) AS count FROM accounts WHERE expires_at IS NULL OR expires_at > ?',
    [nowTs]
  );
  return row ? row.count : 0;
}

async function getTotalExpiredAccounts(db, nowTs) {
  const row = await getOne(
    db,
    'SELECT COUNT(*) AS count FROM accounts WHERE expires_at IS NOT NULL AND expires_at <= ?',
    [nowTs]
  );
  return row ? row.count : 0;
}

async function getTopResellerStatsSince(db, monthStart) {
  return getAll(
    db,
    `SELECT user_id, COUNT(*) AS total_all, SUM(CASE WHEN created_at >= ? THEN 1 ELSE 0 END) AS total_month
     FROM accounts
     GROUP BY user_id
     ORDER BY total_month DESC, total_all DESC`,
    [monthStart]
  );
}

async function getAccountsByUserCreatedBetween(db, userId, startTs, endTs) {
  return getAll(
    db,
    `SELECT created_at, expires_at, type, username
     FROM accounts
     WHERE user_id = ?
       AND created_at >= ?
       AND created_at < ?
     ORDER BY created_at ASC`,
    [userId, startTs, endTs]
  );
}

async function getAccountById(db, accountId) {
  return getOne(
    db,
    'SELECT id, user_id, username, type, server_id, expires_at FROM accounts WHERE id = ?',
    [accountId]
  );
}

async function getAccountDetailWithServerById(db, accountId) {
  return getOne(
    db,
    `SELECT a.id, a.user_id, a.username, a.type, a.server_id, a.expires_at, s.nama_server
     FROM accounts a
     LEFT JOIN Server s ON a.server_id = s.id
     WHERE a.id = ?`,
    [accountId]
  );
}

async function getLatestAccountByIdentity(db, username, serverId, type) {
  return getOne(
    db,
    'SELECT created_at, expires_at FROM accounts WHERE username = ? AND server_id = ? AND type = ? ORDER BY id DESC LIMIT 1',
    [username, serverId, type]
  );
}

async function deleteAccountById(db, accountId) {
  return run(db, 'DELETE FROM accounts WHERE id = ?', [accountId]);
}

module.exports = {
  getTotalAccounts,
  getTotalActiveAccounts,
  getTotalExpiredAccounts,
  getTopResellerStatsSince,
  getAccountsByUserCreatedBetween,
  getAccountById,
  getAccountDetailWithServerById,
  getLatestAccountByIdentity,
  deleteAccountById,
};
