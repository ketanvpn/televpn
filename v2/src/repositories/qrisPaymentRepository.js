async function createQrisPayment(db, payload) {
  const {
    invoiceId,
    userId,
    amount,
    uniqueCode,
    totalAmount,
    providerRef = null,
    createdAt,
    expiresAt,
  } = payload;

  return db.run(
    `INSERT INTO qris_payments (
      invoice_id, user_id, amount, unique_code, total_amount, status, provider_ref, created_at, expires_at
    ) VALUES (?, ?, ?, ?, ?, 'pending', ?, ?, ?)`,
    [invoiceId, userId, amount, uniqueCode, totalAmount, providerRef, createdAt, expiresAt]
  );
}

async function getQrisPaymentByInvoiceId(db, invoiceId) {
  return db.get('SELECT * FROM qris_payments WHERE invoice_id = ? LIMIT 1', [invoiceId]);
}

async function listPendingQrisPaymentsByUser(db, userId) {
  return db.all(
    `SELECT * FROM qris_payments WHERE user_id = ? AND status = 'pending' ORDER BY created_at DESC LIMIT 5`,
    [userId]
  );
}

async function listAllPendingQrisPayments(db, limit = 100) {
  return db.all(
    `SELECT * FROM qris_payments WHERE status = 'pending' ORDER BY created_at ASC LIMIT ?`,
    [Number(limit || 100)]
  );
}

async function markQrisPaid(db, payload) {
  const { invoiceId, providerRef = null, paidAt, matchedAt } = payload;
  return db.run(
    `UPDATE qris_payments
     SET status = 'paid', provider_ref = COALESCE(?, provider_ref), paid_at = ?, matched_at = ?
     WHERE invoice_id = ? AND status = 'pending'`,
    [providerRef, paidAt, matchedAt, invoiceId]
  );
}

async function markQrisExpired(db, invoiceId) {
  return db.run(
    `UPDATE qris_payments SET status = 'expired' WHERE invoice_id = ? AND status = 'pending'`,
    [invoiceId]
  );
}

module.exports = {
  createQrisPayment,
  getQrisPaymentByInvoiceId,
  listPendingQrisPaymentsByUser,
  listAllPendingQrisPayments,
  markQrisPaid,
  markQrisExpired,
};
