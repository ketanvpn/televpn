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

async function getAccountsWithServerPriceByUserCreatedBetween(db, userId, startTs, endTs) {
  return getAll(
    db,
    `SELECT a.created_at, a.expires_at, a.type, a.server_id, s.harga
     FROM accounts a
     LEFT JOIN Server s ON s.id = a.server_id
     WHERE a.user_id = ?
       AND a.created_at >= ?
       AND a.created_at < ?
     ORDER BY a.created_at ASC`,
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

async function getLatestAccountByOwnerIdentity(db, userId, username, type, serverId) {
  return getOne(
    db,
    'SELECT id, created_at, expires_at FROM accounts WHERE user_id = ? AND username = ? AND type = ? AND server_id = ? ORDER BY id DESC LIMIT 1',
    [userId, username, type, serverId]
  );
}

async function updateAccountDatesById(db, accountId, createdAt, expiresAt) {
  return run(db, 'UPDATE accounts SET created_at = ?, expires_at = ? WHERE id = ?', [createdAt, expiresAt, accountId]);
}

async function insertAccountRecord(db, userId, username, type, serverId, createdAt, expiresAt) {
  return run(
    db,
    'INSERT INTO accounts (user_id, username, type, server_id, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?)',
    [userId, username, type, serverId, createdAt, expiresAt]
  );
}

module.exports = {
  getTotalAccounts,
  getTotalActiveAccounts,
  getTotalExpiredAccounts,
  getTopResellerStatsSince,
  getAccountsByUserCreatedBetween,
  getAccountsWithServerPriceByUserCreatedBetween,
  getAccountById,
  getAccountDetailWithServerById,
  getLatestAccountByIdentity,
  deleteAccountById,
  getLatestAccountByOwnerIdentity,
  updateAccountDatesById,
  insertAccountRecord,
};
