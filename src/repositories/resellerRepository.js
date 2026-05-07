const { getOne } = require('./sqliteRepo');

async function getResellerBonusLogByUserAndMonth(db, userId, monthKey) {
  return getOne(
    db,
    'SELECT id, bonus_amount FROM reseller_bonus_logs WHERE user_id = ? AND period_month = ? LIMIT 1',
    [userId, monthKey]
  );
}

async function insertResellerBonusLog(db, payload) {
  const p = payload || {};
  return new Promise((resolve, reject) => {
    db.run(
      `INSERT INTO reseller_bonus_logs (
         user_id, period_month, active_days, bonus_amount, tier_label, processed_at, processed_by, note
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        p.user_id,
        p.period_month,
        Number(p.active_days || 0),
        Number(p.bonus_amount || 0),
        String(p.tier_label || ''),
        p.processed_at,
        p.processed_by || null,
        p.note || null,
      ],
      function onRun(err) {
        if (err) return reject(err);
        resolve({ changes: this.changes, lastID: this.lastID });
      }
    );
  });
}

module.exports = {
  getResellerBonusLogByUserAndMonth,
  insertResellerBonusLog,
};
