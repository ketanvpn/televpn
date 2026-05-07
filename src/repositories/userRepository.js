const { getOne, run } = require('./sqliteRepo');

async function getUserSaldoById(db, userId) {
  const row = await getOne(db, 'SELECT saldo FROM users WHERE user_id = ?', [userId]);
  return row ? Number(row.saldo || 0) : null;
}

async function addUserSaldo(db, userId, amount) {
  return run(db, 'UPDATE users SET saldo = saldo + ? WHERE user_id = ?', [amount, userId]);
}

module.exports = { getUserSaldoById, addUserSaldo };
