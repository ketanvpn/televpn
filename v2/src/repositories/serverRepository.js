async function listActiveServers(db, options = {}) {
  const resellerOnly = options.resellerOnly === true ? 1 : null;
  if (resellerOnly === null) {
    return db.all('SELECT * FROM servers WHERE is_active = 1 ORDER BY id ASC');
  }

  return db.all(
    'SELECT * FROM servers WHERE is_active = 1 AND is_reseller_only = ? ORDER BY id ASC',
    [resellerOnly]
  );
}

async function getServerById(db, serverId) {
  return db.get('SELECT * FROM servers WHERE id = ? LIMIT 1', [serverId]);
}

async function createServer(db, payload) {
  const now = Date.now();
  const { name, domain, authToken, price = 0, isResellerOnly = false } = payload;
  return db.run(
    `INSERT INTO servers (name, domain, auth, price, is_reseller_only, is_active, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 1, ?, ?)`,
    [name, domain || null, authToken || null, Number(price || 0), isResellerOnly ? 1 : 0, now, now]
  );
}

module.exports = {
  listActiveServers,
  getServerById,
  createServer,
};
