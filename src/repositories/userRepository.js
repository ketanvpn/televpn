const { getOne, run } = require('./sqliteRepo');

async function getUserSaldoById(db, userId) {
  const row = await getOne(db, 'SELECT saldo FROM users WHERE user_id = ?', [userId]);
  return row ? Number(row.saldo || 0) : null;
}

async function addUserSaldo(db, userId, amount) {
  return run(db, 'UPDATE users SET saldo = saldo + ? WHERE user_id = ?', [amount, userId]);
}

async function getUserById(db, userId) {
  return getOne(db, 'SELECT * FROM users WHERE user_id = ?', [userId]);
}

async function deductUserSaldoIfEnough(db, userId, amount) {
  return run(
    db,
    'UPDATE users SET saldo = saldo - ? WHERE user_id = ? AND saldo >= ?',
    [amount, userId, amount]
  );
}

module.exports = { getUserSaldoById, addUserSaldo, getUserById, deductUserSaldoIfEnough };
