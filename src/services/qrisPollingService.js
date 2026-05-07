function createQrisPollingService(deps) {
  const {
    process,
    globalState,
    countPendingQrisPayments,
    markQrisPaymentStatusById,
    listRecentPendingQrisPayments,
    checkQrisInvoiceStatus,
    finalizeQrisPayment,
    calculateTopupBonus,
    applyQrisTopupBonus,
    notifyTopupSuccess,
  } = deps;

  function startQrisPaymentPolling(bot, db, logger, options = {}) {
    const qrisCheckIntervalMs = Number(options.qrisCheckIntervalMs || 15000);
    const qrisPaymentTimeoutMin = Number(options.qrisPaymentTimeoutMin || 10);

    const isPrimaryInstance = !process.env.NODE_APP_INSTANCE || process.env.NODE_APP_INSTANCE === '0';
    if (!isPrimaryInstance) {
      logger.info('ℹ️ QRIS polling nonaktif di instance non-primary (PM2 cluster).');
      return;
    }
    if (globalState.__qrisPollStarted) {
      logger.info(`ℹ️ QRIS polling sudah aktif. Interval=${qrisCheckIntervalMs}ms`);
      return;
    }

    async function getPendingQrisCount() {
      return countPendingQrisPayments(db).catch(() => -1);
    }

    async function markQrisStatus(id, status, paidAt = null) {
      return markQrisPaymentStatusById(db, id, status, paidAt);
    }

    async function pollQrisPaymentsStartup() {
      if (globalState.__pollQrisRunning) return;
      globalState.__pollQrisRunning = true;
      try {
        const now = Date.now();
        const timeoutMin = Number(qrisPaymentTimeoutMin || 10);
        const cutoff = now - (timeoutMin + 15) * 60 * 1000;
        const rows = await listRecentPendingQrisPayments(db, cutoff, 50);

        if (!rows.length) return;

        logger.info(`🔎 Poll QRIS GoPay: cek ${rows.length} transaksi pending...`);

        for (const row of rows) {
          const expiresAt = Number(row.created_at) + timeoutMin * 60 * 1000;
          if (now > expiresAt) {
            await markQrisStatus(row.id, 'expired');
            try {
              await bot.telegram.sendMessage(
                row.user_id,
                `⏰ <b>QRIS EXPIRED</b>\n` +
                  `━━━━━━━━━━━━━━━━\n` +
                  `QR sudah tidak berlaku (melewati batas waktu).\n` +
                  `Silakan buat QRIS baru untuk topup.\n` +
                  `━━━━━━━━━━━━━━━━\n` +
                  `Invoice: <code>${row.invoice_id}</code>`,
                {
                  parse_mode: 'HTML',
                  reply_markup: {
                    inline_keyboard: [
                      [{ text: '💳 Buat QRIS Baru', callback_data: 'topupqris_btn' }],
                      [{ text: '🏠 Menu Utama', callback_data: 'send_main_menu' }],
                    ],
                  },
                }
              );
            } catch (_) {}
            logger.info(`⌛ QRIS expired: invoice=${row.invoice_id} user=${row.user_id}`);
            continue;
          }

          const checkRes = await checkQrisInvoiceStatus(row.invoice_id, Number(row.amount), row.created_at);
          if (checkRes.status === 'EXPIRED') {
            await markQrisStatus(row.id, 'expired');
            try {
              await bot.telegram.sendMessage(
                row.user_id,
                `⏰ <b>QRIS EXPIRED</b>\n` +
                  `━━━━━━━━━━━━━━━━\n` +
                  `QR sudah tidak berlaku (melewati batas waktu).\n` +
                  `Silakan buat QRIS baru untuk topup.\n` +
                  `━━━━━━━━━━━━━━━━\n` +
                  `Invoice: <code>${row.invoice_id}</code>`,
                {
                  parse_mode: 'HTML',
                  reply_markup: {
                    inline_keyboard: [
                      [{ text: '💳 Buat QRIS Baru', callback_data: 'topupqris_btn' }],
                      [{ text: '🏠 Menu Utama', callback_data: 'send_main_menu' }],
                    ],
                  },
                }
              );
            } catch (_) {}
            logger.info(`⌛ QRIS expired: invoice=${row.invoice_id} user=${row.user_id}`);
            continue;
          }
          if (checkRes.status === 'CANCELED') {
            await markQrisStatus(row.id, 'canceled');
            logger.info(`🚫 QRIS canceled: invoice=${row.invoice_id} user=${row.user_id}`);
            continue;
          }
          if (checkRes.status !== 'PAID' || !checkRes.transaction) continue;

          const finalRes = await finalizeQrisPayment({
            paymentRow: row,
            matchedTx: checkRes.transaction,
            transactionType: 'qris_auto_topup',
            transactionRef: `qris_auto_${row.invoice_id}`,
          });
          if (!finalRes.applied) continue;

          const addSaldo = Number(row.base_amount);
          try {
            const { bonus, percent } = calculateTopupBonus(addSaldo);
            if (bonus > 0) {
              try {
                await applyQrisTopupBonus(row.user_id, row.invoice_id, bonus);
              } catch (e) {
                logger.error(`⚠️ Gagal mencatat bonus QRIS: ${e?.message || e}`);
              }
              await notifyTopupSuccess({
                bot,
                db,
                userId: row.user_id,
                baseAmount: addSaldo,
                bonusAmount: bonus,
                percent,
                ref: row.invoice_id,
                method: 'QRIS GoPay',
              });
            } else {
              await notifyTopupSuccess({
                bot,
                db,
                userId: row.user_id,
                baseAmount: addSaldo,
                bonusAmount: 0,
                percent: 0,
                ref: row.invoice_id,
                method: 'QRIS GoPay',
              });
            }
          } catch (e) {
            logger.error(`⚠️ Gagal kirim notif topup sukses: ${e?.message || e}`);
          }

          logger.info(
            `✅ QRIS PAID: invoice=${row.invoice_id} user=${row.user_id} billed=${row.amount} add=${addSaldo} tx=${finalRes.providerTxId || '-'} `
          );
        }
      } catch (e) {
        logger.error(`❌ pollQrisPayments fatal: ${e?.message || e}`);
      } finally {
        globalState.__pollQrisRunning = false;
      }
    }

    globalState.__qrisPollStarted = true;
    globalState.__qrisPollInterval = setInterval(pollQrisPaymentsStartup, qrisCheckIntervalMs);
    setTimeout(() => {
      pollQrisPaymentsStartup().catch(() => {});
    }, 2000);
    getPendingQrisCount()
      .then((pendingCount) => {
        if (pendingCount >= 0) {
          logger.info(`✅ QRIS polling aktif. Interval=${qrisCheckIntervalMs}ms, pending=${pendingCount}, source=startup`);
        } else {
          logger.info(`✅ QRIS polling aktif. Interval=${qrisCheckIntervalMs}ms, source=startup`);
        }
      })
      .catch(() => {
        logger.info(`✅ QRIS polling aktif. Interval=${qrisCheckIntervalMs}ms, source=startup`);
      });
  }

  return { startQrisPaymentPolling };
}

module.exports = { createQrisPollingService };
