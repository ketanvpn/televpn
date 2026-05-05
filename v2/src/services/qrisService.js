const {
  createQrisPayment,
  getQrisPaymentByInvoiceId,
  markQrisPaid,
  markQrisExpired,
} = require('../repositories/qrisPaymentRepository');
const { adjustSaldoWithLedger } = require('./walletService');

const QRIS_TIMEOUT_MS = 15 * 60 * 1000;

function makeInvoiceId(userId) {
  const ts = Date.now();
  const rand = Math.floor(Math.random() * 900 + 100);
  return `INV-${userId}-${ts}-${rand}`;
}

function makeUniqueCode() {
  return Math.floor(Math.random() * 151) + 50;
}

async function createTopupInvoice(db, userId, amount) {
  const nominal = Number(amount || 0);
  if (!Number.isFinite(nominal) || nominal <= 0) {
    throw new Error('Nominal topup tidak valid');
  }

  const createdAt = Date.now();
  const uniqueCode = makeUniqueCode();
  const totalAmount = nominal + uniqueCode;
  const invoiceId = makeInvoiceId(userId);
  const expiresAt = createdAt + QRIS_TIMEOUT_MS;

  await createQrisPayment(db, {
    invoiceId,
    userId,
    amount: nominal,
    uniqueCode,
    totalAmount,
    createdAt,
    expiresAt,
  });

  return {
    invoiceId,
    amount: nominal,
    uniqueCode,
    totalAmount,
    createdAt,
    expiresAt,
  };
}

async function finalizeInvoiceAsPaid(db, payload) {
  const { invoiceId, providerRef = null } = payload;

  await db.exec('BEGIN IMMEDIATE TRANSACTION');
  try {
    const row = await getQrisPaymentByInvoiceId(db, invoiceId);
    if (!row) {
      await db.exec('ROLLBACK');
      return { ok: false, reason: 'not_found' };
    }

    if (row.status === 'paid') {
      await db.exec('ROLLBACK');
      return { ok: true, alreadyPaid: true, userId: row.user_id, amount: row.amount };
    }

    if (row.status !== 'pending') {
      await db.exec('ROLLBACK');
      return { ok: false, reason: `invalid_status:${row.status}` };
    }

    const now = Date.now();
    if (now > Number(row.expires_at || 0)) {
      await markQrisExpired(db, invoiceId);
      await db.exec('COMMIT');
      return { ok: false, reason: 'expired' };
    }

    const updateRes = await markQrisPaid(db, {
      invoiceId,
      providerRef,
      paidAt: now,
      matchedAt: now,
    });

    if (!updateRes.changes) {
      await db.exec('ROLLBACK');
      return { ok: false, reason: 'not_pending' };
    }

    const ledger = await adjustSaldoWithLedger(db, {
      userId: row.user_id,
      amount: Number(row.amount),
      type: 'qris_topup',
      referenceId: `qris_topup_${invoiceId}`,
      note: `QRIS payment ${invoiceId}`,
    });

    if (!ledger.applied && ledger.reason !== 'duplicate_reference') {
      throw new Error(`ledger_failed:${ledger.reason}`);
    }

    await db.exec('COMMIT');
    return {
      ok: true,
      alreadyPaid: false,
      userId: row.user_id,
      amount: Number(row.amount),
      saldo: Number(ledger.saldo || 0),
    };
  } catch (err) {
    await db.exec('ROLLBACK');
    throw err;
  }
}

module.exports = {
  createTopupInvoice,
  finalizeInvoiceAsPaid,
};
