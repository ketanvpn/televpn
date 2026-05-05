async function createTransaction(db, payload) {
  const { userId, amount, type, referenceId, note = null } = payload;
  const now = Date.now();

  return db.run(
    `INSERT INTO transactions (user_id, amount, type, reference_id, note, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [userId, amount, type, referenceId, note, now]
  );
}

async function hasReferenceId(db, referenceId) {
  const row = await db.get('SELECT id FROM transactions WHERE reference_id = ? LIMIT 1', [referenceId]);
  return !!row;
}

module.exports = {
  createTransaction,
  hasReferenceId,
};
