const { run } = require('./sqliteRepo');

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

module.exports = { insertTransaction };
