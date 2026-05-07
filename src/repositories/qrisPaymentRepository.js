const { getOne, getAll, run } = require('./sqliteRepo');

async function getQrisPaymentByInvoiceId(db, invoiceId) {
  return getOne(db, 'SELECT * FROM qris_payments WHERE invoice_id = ? LIMIT 1', [invoiceId]);
}

async function getQrisPaymentById(db, id) {
  return getOne(db, 'SELECT id, status, paid_at FROM qris_payments WHERE id = ? LIMIT 1', [id]);
}

async function getLatestQrisPaymentByInvoiceId(db, invoiceId) {
  return getOne(db, 'SELECT * FROM qris_payments WHERE invoice_id = ? ORDER BY id DESC LIMIT 1', [invoiceId]);
}

async function getQrisPaymentStatusByInvoiceId(db, invoiceId) {
  return getOne(
    db,
    'SELECT status, amount, base_amount, unique_suffix, created_at, paid_at FROM qris_payments WHERE invoice_id = ? ORDER BY id DESC LIMIT 1',
    [invoiceId]
  );
}

async function countPendingQrisPayments(db) {
  const row = await getOne(db, "SELECT COUNT(*) AS cnt FROM qris_payments WHERE status='pending'", []);
  return Number(row?.cnt || 0);
}

async function getLatestPendingQrisPaymentByUserId(db, userId) {
  return getOne(
    db,
    `SELECT * FROM qris_payments
     WHERE user_id = ? AND status = 'pending'
     ORDER BY created_at DESC
     LIMIT 1`,
    [userId]
  );
}

async function markQrisPaymentStatusById(db, id, status, paidAt = null) {
  if (paidAt) {
    return run(db, 'UPDATE qris_payments SET status=?, paid_at=? WHERE id=?', [status, paidAt, id]);
  }
  return run(db, 'UPDATE qris_payments SET status=? WHERE id=?', [status, id]);
}

async function markQrisPaymentAsPaidById(db, id, payload) {
  const p = payload || {};
  return run(
    db,
    `UPDATE qris_payments
       SET status = 'paid',
           paid_at = ?,
           matched_at = ?,
           provider_tx_id = ?,
           provider_tx_time = ?,
           provider_payment_type = ?,
           provider_issuer = ?,
           provider_status = ?,
           provider_payload_json = ?
     WHERE id = ? AND status != 'paid'`,
    [
      p.paid_at,
      p.matched_at,
      p.provider_tx_id,
      p.provider_tx_time,
      p.provider_payment_type,
      p.provider_issuer,
      p.provider_status,
      p.provider_payload_json,
      id,
    ]
  );
}

async function listRecentPendingQrisPayments(db, cutoff, limit = 50) {
  return getAll(
    db,
    `SELECT id, user_id, invoice_id, amount, base_amount, unique_suffix, created_at
     FROM qris_payments
     WHERE status='pending' AND created_at >= ?
     ORDER BY created_at ASC
     LIMIT ?`,
    [cutoff, Number(limit || 50)]
  );
}

async function insertPendingQrisPayment(db, payload) {
  const p = payload || {};
  return run(
    db,
    `INSERT INTO qris_payments (
       user_id,
       invoice_id,
       amount,
       base_amount,
       unique_suffix,
       status,
       created_at,
       provider_tx_id,
       provider_tx_time,
       provider_payment_type,
       provider_issuer,
       provider_status,
       provider_payload_json
     )
     VALUES (?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?, ?)`,
    [
      p.user_id,
      p.invoice_id,
      p.amount,
      p.base_amount,
      p.unique_suffix,
      p.created_at,
      p.provider_tx_id,
      p.provider_tx_time,
      p.provider_payment_type,
      p.provider_issuer,
      p.provider_status,
      p.provider_payload_json,
    ]
  );
}

async function insertQrisPaymentRecord(db, payload) {
  const p = payload || {};
  return run(
    db,
    `INSERT INTO qris_payments (
       user_id,
       invoice_id,
       amount,
       base_amount,
       unique_suffix,
       status,
       created_at,
       paid_at,
       matched_at,
       provider_tx_id,
       provider_tx_time,
       provider_payment_type,
       provider_issuer,
       provider_status,
       provider_payload_json
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      p.user_id,
      p.invoice_id,
      p.amount,
      p.base_amount,
      p.unique_suffix,
      p.status,
      p.created_at,
      p.paid_at || null,
      p.matched_at || null,
      p.provider_tx_id || null,
      p.provider_tx_time || null,
      p.provider_payment_type || null,
      p.provider_issuer || null,
      p.provider_status || null,
      p.provider_payload_json || null,
    ]
  );
}

module.exports = {
  getQrisPaymentByInvoiceId,
  getQrisPaymentById,
  getLatestQrisPaymentByInvoiceId,
  getQrisPaymentStatusByInvoiceId,
  countPendingQrisPayments,
  getLatestPendingQrisPaymentByUserId,
  markQrisPaymentStatusById,
  markQrisPaymentAsPaidById,
  listRecentPendingQrisPayments,
  insertPendingQrisPayment,
  insertQrisPaymentRecord,
};
