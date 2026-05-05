async function upsertUser(db, telegramUser) {
  const now = Date.now();
  await db.run(
    `INSERT INTO users (user_id, username, first_name, role, saldo, created_at, updated_at)
     VALUES (?, ?, ?, 'member', 0, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET
       username=excluded.username,
       first_name=excluded.first_name,
       updated_at=excluded.updated_at`,
    [
      telegramUser.id,
      telegramUser.username || null,
      telegramUser.first_name || null,
      now,
      now,
    ]
  );

  return db.get('SELECT * FROM users WHERE user_id = ?', [telegramUser.id]);
}

async function getUserById(db, userId) {
  return db.get('SELECT * FROM users WHERE user_id = ?', [userId]);
}

async function setUserRole(db, userId, role) {
  const now = Date.now();
  return db.run('UPDATE users SET role = ?, updated_at = ? WHERE user_id = ?', [role, now, userId]);
}

module.exports = {
  upsertUser,
  getUserById,
  setUserRole,
};
