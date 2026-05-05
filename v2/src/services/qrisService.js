const axios = require('axios');
const { config } = require('../core/config');
const { logger } = require('../core/logger');
const {
  createQrisPayment,
  getQrisPaymentByInvoiceId,
  listAllPendingQrisPayments,
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

  let providerRef = null;
  let providerPayload = null;
  if (config.gopayApiKey) {
    try {
      const res = await axios.post(
        `${config.gopayApiBaseUrl}/qris/generate`,
        { amount: totalAmount },
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${config.gopayApiKey}`,
          },
          timeout: 15000,
        }
      );
      if (res.data && res.data.success && res.data.data) {
        providerRef = String(res.data.data.transaction_id || '').trim() || null;
        providerPayload = res.data.data;
      }
    } catch (err) {
      logger.warn(`QRIS generate live gagal, fallback manual invoice: ${err.message}`);
    }
  }

  await createQrisPayment(db, {
    invoiceId,
    userId,
    amount: nominal,
    uniqueCode,
    totalAmount,
    providerRef,
    createdAt,
    expiresAt,
  });

  return {
    invoiceId,
    amount: nominal,
    uniqueCode,
    totalAmount,
    providerRef,
    providerPayload,
    createdAt,
    expiresAt,
  };
}

async function checkProviderStatus(providerRef) {
  if (!providerRef || !config.gopayApiKey) return null;
  const res = await axios.post(
    `${config.gopayApiBaseUrl}/qris/status`,
    { transaction_id: providerRef },
    {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.gopayApiKey}`,
      },
      timeout: 15000,
    }
  );

  if (!res.data || !res.data.data) return null;
  return res.data.data;
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

async function checkInvoiceStatus(db, invoiceId) {
  const row = await getQrisPaymentByInvoiceId(db, invoiceId);
  if (!row) return { ok: false, reason: 'not_found' };

  if (row.status === 'paid') return { ok: true, status: 'paid', row };
  if (row.status === 'expired') return { ok: true, status: 'expired', row };

  const now = Date.now();
  if (now > Number(row.expires_at || 0)) {
    await markQrisExpired(db, invoiceId);
    return { ok: true, status: 'expired', row: { ...row, status: 'expired' } };
  }

  if (!row.provider_ref) {
    return { ok: true, status: 'pending', row };
  }

  const provider = await checkProviderStatus(row.provider_ref);
  const providerStatus = String(provider?.transaction_status || '').toLowerCase();

  if (providerStatus === 'settlement') {
    const finalized = await finalizeInvoiceAsPaid(db, {
      invoiceId,
      providerRef: row.provider_ref,
    });
    return { ok: true, status: finalized.alreadyPaid ? 'paid' : 'paid', row, finalized };
  }

  if (providerStatus === 'expire' || providerStatus === 'cancel') {
    await markQrisExpired(db, invoiceId);
    return { ok: true, status: 'expired', row: { ...row, status: 'expired' } };
  }

  return { ok: true, status: 'pending', row };
}

async function pollPendingQrisPayments(db, bot) {
  if (!config.gopayApiKey) return;

  const rows = await listAllPendingQrisPayments(db, 100);
  for (const row of rows) {
    try {
      const status = await checkInvoiceStatus(db, row.invoice_id);
      if (status.status === 'paid' && status.finalized && status.finalized.userId) {
        const saldoNow = Number(status.finalized.saldo || 0);
        await bot.telegram.sendMessage(
          status.finalized.userId,
          `Topup QRIS berhasil. Nominal masuk: Rp${Number(status.finalized.amount || 0).toLocaleString('id-ID')}. Saldo: Rp${saldoNow.toLocaleString('id-ID')}.`
        ).catch(() => null);
      }
    } catch (err) {
      logger.warn(`Poll QRIS invoice ${row.invoice_id} gagal: ${err.message}`);
    }
  }
}

module.exports = {
  createTopupInvoice,
  finalizeInvoiceAsPaid,
  checkInvoiceStatus,
  pollPendingQrisPayments,
};
