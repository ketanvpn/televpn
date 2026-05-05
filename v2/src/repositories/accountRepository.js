async function createAccountRecord(db, payload) {
  const { userId, username, type, serverId, createdAt, expiresAt, status = 'active' } = payload;
  return db.run(
    `INSERT INTO accounts (user_id, username, type, server_id, created_at, expires_at, status)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [userId, username, type, serverId || null, createdAt, expiresAt || null, status]
  );
}

async function listAccountsByUser(db, userId, limit = 20) {
  return db.all(
    `SELECT a.*, s.name AS server_name
     FROM accounts a
     LEFT JOIN servers s ON s.id = a.server_id
     WHERE a.user_id = ?
     ORDER BY a.created_at DESC
     LIMIT ?`,
    [userId, Number(limit || 20)]
  );
}

async function getLatestAccountByUserTypeUsername(db, payload) {
  const { userId, type, username } = payload;
  return db.get(
    `SELECT * FROM accounts
     WHERE user_id = ? AND type = ? AND username = ?
     ORDER BY created_at DESC
     LIMIT 1`,
    [userId, type, username]
  );
}

async function updateAccountExpiry(db, accountId, expiresAt) {
  return db.run('UPDATE accounts SET expires_at = ?, status = ? WHERE id = ?', [expiresAt, 'active', accountId]);
}

async function markAccountDeleted(db, accountId) {
  return db.run('UPDATE accounts SET status = ? WHERE id = ?', ['deleted', accountId]);
}

async function updateLatestAccountStatus(db, payload) {
  const { userId, type, username, status } = payload;
  const row = await getLatestAccountByUserTypeUsername(db, { userId, type, username });
  if (!row) return { changes: 0 };
  return db.run('UPDATE accounts SET status = ? WHERE id = ?', [status, row.id]);
}

module.exports = {
  createAccountRecord,
  listAccountsByUser,
  getLatestAccountByUserTypeUsername,
  updateAccountExpiry,
  markAccountDeleted,
  updateLatestAccountStatus,
};
