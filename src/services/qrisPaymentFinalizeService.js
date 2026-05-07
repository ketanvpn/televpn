function createQrisPaymentFinalizeService(deps) {
  const {
    run,
    getQrisPaymentById,
    markQrisPaymentAsPaidById,
    addUserSaldo,
    insertTransaction,
    getTransactionByReferenceId,
  } = deps;

  async function finalizeQrisPayment(db, payload) {
    const {
      paymentRow,
      matchedTx,
      transactionType = 'qris_auto_topup',
      transactionRef = null,
    } = payload || {};

    const row = paymentRow || {};
    const tx = matchedTx || {};

    const paymentId = Number(row.id || 0);
    const userId = Number(row.user_id || 0);
    const invoiceId = String(row.invoice_id || '').trim();
    const baseAmount = Number(row.base_amount || row.amount || 0);
    const paidAt = (() => {
      const raw = tx.transaction_time || tx.time || tx.paid_at || tx.timestamp || Date.now();
      const parsed =
        typeof raw === 'number' ? raw : new Date(String(raw).replace(' ', 'T')).getTime();
      return Number.isFinite(parsed) && parsed > 0 ? parsed : Date.now();
    })();
    const matchedAt = Date.now();
    const providerPayloadJson = (() => {
      try {
        return JSON.stringify(tx);
      } catch (_) {
        return null;
      }
    })();

    if (!paymentId || !userId || !invoiceId || !Number.isFinite(baseAmount) || baseAmount <= 0) {
      throw new Error('Data finalize QRIS tidak valid');
    }

    await run(db, 'BEGIN IMMEDIATE TRANSACTION');
    try {
      const current = await getQrisPaymentById(db, paymentId);
      if (!current) {
        await run(db, 'ROLLBACK');
        throw new Error('Invoice QRIS tidak ditemukan');
      }
      if (String(current.status || '').toLowerCase() === 'paid') {
        await run(db, 'ROLLBACK');
        return { applied: false, alreadyPaid: true, paidAt: current.paid_at || null };
      }

      const upd = await markQrisPaymentAsPaidById(db, paymentId, {
        paid_at: paidAt,
        matched_at: matchedAt,
        provider_tx_id: tx.transaction_id || tx.id || null,
        provider_tx_time: tx.transaction_time || tx.time || null,
        provider_payment_type: tx.payment_type || 'qris',
        provider_issuer: tx.issuer || 'gopay',
        provider_status: tx.transaction_status || tx.status || null,
        provider_payload_json: providerPayloadJson,
      });
      if (!upd.changes) {
        await run(db, 'ROLLBACK');
        return { applied: false, alreadyPaid: true, paidAt: current.paid_at || null };
      }

      const saldoRes = await addUserSaldo(db, userId, baseAmount);
      if (!saldoRes.changes) {
        await run(db, 'ROLLBACK');
        throw new Error('User untuk topup QRIS tidak ditemukan');
      }

      await insertTransaction(db, {
        userId,
        amount: baseAmount,
        type: transactionType,
        referenceId: transactionRef || `qris_${invoiceId}`,
        timestamp: matchedAt,
      });

      await run(db, 'COMMIT');
      return { applied: true, alreadyPaid: false, paidAt, matchedAt };
    } catch (err) {
      try {
        await run(db, 'ROLLBACK');
      } catch (_) {}
      throw err;
    }
  }

  async function applyQrisTopupBonus(db, userId, invoiceId, bonusAmount) {
    const uid = Number(userId || 0);
    const bonus = Number(bonusAmount || 0);
    const inv = String(invoiceId || '').trim();
    const refId = `qris_bonus_${inv}`;
    const now = Date.now();

    if (!uid || !inv || !Number.isFinite(bonus) || bonus <= 0) {
      return { applied: false, skipped: true };
    }

    await run(db, 'BEGIN IMMEDIATE TRANSACTION');
    try {
      const existing = await getTransactionByReferenceId(db, refId);
      if (existing) {
        await run(db, 'ROLLBACK');
        return { applied: false, alreadyApplied: true };
      }

      const saldoRes = await addUserSaldo(db, uid, bonus);
      if (!saldoRes.changes) {
        await run(db, 'ROLLBACK');
        throw new Error('User bonus QRIS tidak ditemukan');
      }

      await insertTransaction(db, {
        userId: uid,
        amount: bonus,
        type: 'qris_topup_bonus',
        referenceId: refId,
        timestamp: now,
      });

      await run(db, 'COMMIT');
      return { applied: true, alreadyApplied: false, refId };
    } catch (err) {
      try {
        await run(db, 'ROLLBACK');
      } catch (_) {}
      throw err;
    }
  }

  return { finalizeQrisPayment, applyQrisTopupBonus };
}

module.exports = { createQrisPaymentFinalizeService };
