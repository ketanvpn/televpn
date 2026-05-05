async function getSetting(db, key) {
  const row = await db.get('SELECT value FROM app_settings WHERE key = ? LIMIT 1', [String(key)]);
  return row ? row.value : null;
}

async function setSetting(db, key, value) {
  const now = Date.now();
  return db.run(
    `INSERT INTO app_settings (key, value, updated_at)
     VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    [String(key), String(value), now]
  );
}

module.exports = {
  getSetting,
  setSetting,
};
