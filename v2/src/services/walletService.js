const { createTransaction, hasReferenceId } = require('../repositories/transactionRepository');
const { getUserById } = require('../repositories/userRepository');

async function adjustSaldoWithLedger(db, payload) {
  const { userId, amount, type, referenceId, note = null } = payload;
  if (!Number.isFinite(amount) || amount === 0) {
    throw new Error('amount must be non-zero number');
  }
  if (!referenceId) {
    throw new Error('referenceId is required');
  }

  await db.exec('BEGIN IMMEDIATE TRANSACTION');
  try {
    const exists = await hasReferenceId(db, referenceId);
    if (exists) {
      await db.exec('ROLLBACK');
      return { applied: false, reason: 'duplicate_reference' };
    }

    const user = await getUserById(db, userId);
    if (!user) {
      throw new Error('user not found');
    }

    const nextSaldo = Number(user.saldo || 0) + Number(amount);
    if (nextSaldo < 0) {
      await db.exec('ROLLBACK');
      return { applied: false, reason: 'insufficient_balance' };
    }

    await db.run('UPDATE users SET saldo = ?, updated_at = ? WHERE user_id = ?', [nextSaldo, Date.now(), userId]);
    await createTransaction(db, { userId, amount, type, referenceId, note });
    await db.exec('COMMIT');
    return { applied: true, saldo: nextSaldo };
  } catch (err) {
    await db.exec('ROLLBACK');
    throw err;
  }
}

module.exports = {
  adjustSaldoWithLedger,
};
