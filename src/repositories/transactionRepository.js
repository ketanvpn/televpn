const { getOne, getAll, run } = require('./sqliteRepo');

async function insertTransaction(db, payload) {
  const {
    userId,
    amount = null,
    type,
    referenceId = null,
    timestamp = Date.now(),
  } = payload;

  return run(
    db,
    'INSERT INTO transactions (user_id, amount, type, reference_id, timestamp) VALUES (?, ?, ?, ?, ?)',
    [userId, amount, type, referenceId, timestamp]
  );
}

async function getTransactionByReferenceId(db, referenceId) {
  return getOne(db, 'SELECT id FROM transactions WHERE reference_id = ? LIMIT 1', [referenceId]);
}

async function getAnyTransactionWithNullReference(db) {
  return getOne(db, 'SELECT * FROM transactions WHERE reference_id IS NULL LIMIT 1', []);
}

async function listTransactionsWithNullReference(db) {
  return getAll(db, 'SELECT id, user_id, type, timestamp FROM transactions WHERE reference_id IS NULL', []);
}

async function updateTransactionReferenceById(db, id, referenceId) {
  return run(db, 'UPDATE transactions SET reference_id = ? WHERE id = ?', [referenceId, id]);
}

async function getRecentSaldoTransactionsByUserId(db, userId, limit = 20) {
  return getAll(
    db,
    'SELECT amount, type, reference_id, timestamp FROM transactions WHERE user_id = ? AND amount IS NOT NULL ORDER BY timestamp DESC LIMIT ?',
    [userId, Number(limit || 20)]
  );
}

async function backfillMissingTransactionReferences(db) {
  const rows = await listTransactionsWithNullReference(db);
  for (const row of rows) {
    const referenceId = `account-${row.type}-${row.user_id}-${row.timestamp}`;
    await updateTransactionReferenceById(db, row.id, referenceId);
  }
  return rows.length;
}

module.exports = {
  insertTransaction,
  getTransactionByReferenceId,
  getAnyTransactionWithNullReference,
  listTransactionsWithNullReference,
  updateTransactionReferenceById,
  getRecentSaldoTransactionsByUserId,
  backfillMissingTransactionReferences,
};
