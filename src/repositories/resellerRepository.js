const { getOne } = require('./sqliteRepo');

async function getResellerBonusLogByUserAndMonth(db, userId, monthKey) {
  return getOne(
    db,
    'SELECT id, bonus_amount FROM reseller_bonus_logs WHERE user_id = ? AND period_month = ? LIMIT 1',
    [userId, monthKey]
  );
}

module.exports = {
  getResellerBonusLogByUserAndMonth,
};
