function createQrisTopupFlowService(deps) {
  const {
    getLatestPendingQrisPaymentByUserId,
    markQrisPaymentStatusById,
    createQrisInvoice,
    listRecentPendingQrisPayments,
    fetchGopayTransactions,
    findMatchingSettlementTransaction,
    finalizeQrisPayment,
    calculateTopupBonus,
    applyQrisTopupBonus,
    notifyTopupSuccess,
    insertPendingQrisPayment,
    qrisPaymentTimeoutMin,
    qrisCheckIntervalMs,
  } = deps;

  async function processQrisTopupInvoice(ctx, baseAmount, forcedUniqueSuffix = null, runtime = {}) {
    const { bot, db, logger, globalState, processObj } = runtime;
    let loadingMsg = null;

    try {
      loadingMsg = await ctx.reply('⏳ Sedang membuat QRIS...', {
        reply_markup: { remove_keyboard: true },
      });
    } catch (_) {}

    const cleanupLoadingMessage = async () => {
      if (!loadingMsg?.message_id) return;
      try {
        await ctx.telegram.deleteMessage(ctx.chat.id, loadingMsg.message_id);
      } catch (_) {}
      loadingMsg = null;
    };

    try {
      const userId = ctx.from.id;
      const now = Date.now();
      const timeoutMin = qrisPaymentTimeoutMin || 5;
      const expireThreshold = now - timeoutMin * 60 * 1000;

      const pendingRow = await getLatestPendingQrisPaymentByUserId(db, userId);

      if (pendingRow) {
        if (pendingRow.created_at >= expireThreshold) {
          await ctx.reply(
            '⚠️ Kamu masih punya 1 topup QRIS yang <b>belum dibayar</b>.\n\n' +
              `🧾 Invoice : <code>${pendingRow.invoice_id}</code>\n` +
              `💳 Nominal : <b>Rp${pendingRow.amount.toLocaleString('id-ID')}</b>\n\n` +
              `Silakan selesaikan pembayaran QRIS tersebut dulu, atau tunggu sekitar <b>${timeoutMin} menit</b> sampai kadaluarsa sebelum membuat topup baru.`,
            { parse_mode: 'HTML' }
          );
          return;
        }

        await markQrisPaymentStatusById(db, pendingRow.id, 'expired').catch((err) => {
          logger.error('⚠️ Gagal meng-update qris_payments ke expired dari handler nominal:', err);
        });
      }
    } catch (e) {
      logger.error('⚠️ Error saat cek invoice pending QRIS:', e);
    }

    try {
      const userId = ctx.from.id;
      const invoice = await createQrisInvoice(
        baseAmount,
        `Topup saldo user ${userId} (base=${baseAmount})`,
        forcedUniqueSuffix
      );

      async function markQrisStatus(id, status, paidAt = null) {
        return markQrisPaymentStatusById(db, id, status, paidAt);
      }

      async function pollQrisPayments() {
        if (globalState.__pollQrisRunning) return;
        globalState.__pollQrisRunning = true;
        try {
          const now = Date.now();
          const timeoutMin = Number(qrisPaymentTimeoutMin || 10);
          const cutoff = now - (timeoutMin + 15) * 60 * 1000;
          const rows = await listRecentPendingQrisPayments(db, cutoff, 50);
          if (!rows.length) return;

          logger.info(`🔎 Poll QRIS GoPay: cek ${rows.length} transaksi pending...`);
          const transactions = await fetchGopayTransactions();

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

            const matchedTx = findMatchingSettlementTransaction(transactions, Number(row.amount), {
              createdAt: row.created_at,
              timeWindowMs: timeoutMin * 60 * 1000,
            });
            if (!matchedTx) continue;

            const finalRes = await finalizeQrisPayment({
              paymentRow: row,
              matchedTx,
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

            logger.info(`✅ QRIS PAID: invoice=${row.invoice_id} user=${row.user_id} billed=${row.amount} add=${addSaldo} tx=${finalRes.providerTxId || '-'} `);
          }
        } catch (e) {
          logger.error(`❌ pollQrisPayments fatal: ${e?.message || e}`);
        } finally {
          globalState.__pollQrisRunning = false;
        }
      }

      globalState.__qrisPollStarted = globalState.__qrisPollStarted || false;
      const isPrimaryInstance = !processObj.env.NODE_APP_INSTANCE || processObj.env.NODE_APP_INSTANCE === '0';
      if (isPrimaryInstance && !globalState.__qrisPollStarted) {
        globalState.__qrisPollStarted = true;
        setInterval(pollQrisPayments, Number(qrisCheckIntervalMs || 15000));
        logger.info(`✅ QRIS polling aktif. Interval=${Number(qrisCheckIntervalMs || 15000)}ms`);
      } else if (!isPrimaryInstance) {
        logger.info('ℹ️ QRIS polling nonaktif di instance non-primary (PM2 cluster).');
      }

      const billedAmount = invoice.amount;
      const randomSuffix = invoice.unique_suffix;
      const now = Date.now();
      const providerPayloadJson = (() => {
        try {
          return JSON.stringify(invoice.raw || {});
        } catch (_) {
          return null;
        }
      })();

      await insertPendingQrisPayment(db, {
        user_id: userId,
        invoice_id: invoice.invoice_id,
        amount: invoice.amount,
        base_amount: invoice.base_amount,
        unique_suffix: invoice.unique_suffix,
        created_at: now,
        provider_tx_id: invoice.provider_transaction_id || null,
        provider_tx_time: invoice.provider_transaction_time || null,
        provider_payment_type: invoice.provider_payment_type || 'qris',
        provider_issuer: invoice.provider_issuer || 'gopay',
        provider_status: invoice.provider_status || 'pending',
        provider_payload_json: providerPayloadJson,
      });

      let caption =
        `✅ <b>QRIS TOPUP DIBUAT</b>\n` +
        `━━━━━━━━━━━━━━━━\n` +
        `🧾 <b>Invoice</b> : <code>${invoice.invoice_id}</code>\n` +
        `💳 <b>Nominal</b> : <b>Rp${baseAmount.toLocaleString('id-ID')}</b>\n` +
        (randomSuffix > 0
          ? `🎲 <b>Kode unik</b> : <b>${randomSuffix.toString().padStart(3, '0')}</b>\n` +
            `💰 <b>Total bayar</b> : <b>Rp${billedAmount.toLocaleString('id-ID')}</b>\n`
          : `💰 <b>Total bayar</b> : <b>Rp${billedAmount.toLocaleString('id-ID')}</b>\n`) +
        `━━━━━━━━━━━━━━━━\n` +
        `📌 Scan QR lalu bayar sesuai <b>TOTAL BAYAR</b>\n` +
        `⏰ <b>Berlaku ${qrisPaymentTimeoutMin} menit</b>\n` +
        'Saldo masuk otomatis setelah terdeteksi.';

      const payKb = {
        inline_keyboard: [
          [{ text: '🔎 Cek Status', callback_data: `qris_status:${invoice.invoice_id}` }],
          [{ text: '🏠 Menu Utama', callback_data: 'send_main_menu' }],
        ],
      };

      await cleanupLoadingMessage();

      if (invoice.qris_image_path) {
        await ctx.replyWithPhoto({ source: invoice.qris_image_path }, { caption, parse_mode: 'HTML', reply_markup: payKb });
      } else if (invoice.qris_image_url) {
        await ctx.replyWithPhoto({ url: invoice.qris_image_url }, { caption, parse_mode: 'HTML', reply_markup: payKb });
      } else if (invoice.payment_link) {
        await ctx.reply(caption + `\n\n🔗 Link Pembayaran:\n${invoice.payment_link}`, {
          parse_mode: 'HTML',
          reply_markup: payKb,
        });
      } else if (invoice.qris_text) {
        await ctx.reply(
          caption + `\n\nKode QRIS:\n<code>${invoice.qris_text}</code>\n\n` + 'Silakan buat QR dari text di atas jika diperlukan.',
          { parse_mode: 'HTML', reply_markup: payKb }
        );
      } else {
        await ctx.reply('⚠️ Gagal membuat QRIS. Coba lagi nanti.', {
          parse_mode: 'HTML',
          reply_markup: payKb,
        });
      }
    } catch (e) {
      logger.error('❌ Error saat proses topup QRIS dari input nominal:', e);
      await cleanupLoadingMessage();
      await ctx.reply('❌ Terjadi kesalahan saat membuat QRIS. Coba lagi beberapa saat.', { parse_mode: 'HTML' });
    }
  }

  return { processQrisTopupInvoice };
}

module.exports = { createQrisTopupFlowService };
