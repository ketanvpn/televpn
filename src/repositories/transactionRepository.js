const { getOne, run } = require('./sqliteRepo');

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

module.exports = { insertTransaction, getTransactionByReferenceId };
