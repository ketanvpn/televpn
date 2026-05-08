function createQrisPendingDepositMonitorService(deps) {
  const {
    globalState,
    fetchGopayTransactions,
    findMatchingSettlementTransaction,
    markDepositExpired,
    creditDeposit,
    qrisPaymentTimeoutMin,
    pollIntervalMs = 10000,
    depositExpireMs = 5 * 60 * 1000,
    isPrimaryInstance = true,
  } = deps;

  let lastPollTime = 0;

  async function pollMutasi(bot, db, logger) {
    globalState.mutasiBlockedUntil = globalState.mutasiBlockedUntil || 0;
    if (Date.now() < globalState.mutasiBlockedUntil) return;

    const now = Date.now();
    if (now - lastPollTime < pollIntervalMs) return;
    lastPollTime = now;

    const entries = Object.entries(globalState.pendingDeposits || {}).filter(([, d]) => d.status === 'pending');
    if (entries.length === 0) return;

    try {
      const transactions = await fetchGopayTransactions();
      for (const [uniqueCode, deposit] of entries) {
        const expiresAt = deposit.expiresAt || (deposit.timestamp ? (deposit.timestamp + depositExpireMs) : 0);
        if (expiresAt && now > expiresAt) {
          await markDepositExpired(uniqueCode, bot, db, logger);
          continue;
        }

        const matched = findMatchingSettlementTransaction(transactions, deposit.amount, {
          createdAt: deposit.timestamp,
          timeWindowMs: depositExpireMs,
        });
        if (matched) {
          await creditDeposit(uniqueCode, bot, db, logger, matched);
        }
      }
    } catch (error) {
      const status = error?.response?.status;
      const msg = error?.response?.data?.message || error?.message || error;
      logger.error(`❌ Poll mutasi GoPay error (${status || 'no-status'}): ${msg}`);
    }
  }

  async function checkQRISStatus(bot, db, logger) {
    try {
      const entries = Object.entries(globalState.pendingDeposits || {}).filter(([, d]) => d.status === 'pending');
      if (entries.length === 0) return;

      const timeoutMin = Number(qrisPaymentTimeoutMin || 10);
      const transactions = await fetchGopayTransactions();

      for (const [uniqueCode, deposit] of entries) {
        const expiredAt = deposit.expiresAt || (deposit.timestamp + timeoutMin * 60 * 1000);
        if (Date.now() > expiredAt) {
          try {
            if (deposit.qrMessageId) {
              await bot.telegram.deleteMessage(deposit.userId, deposit.qrMessageId);
            }
          } catch (_) {}
          await markDepositExpired(uniqueCode, bot, db, logger);
          continue;
        }

        const matched = findMatchingSettlementTransaction(transactions, deposit.amount);
        if (matched) {
          await creditDeposit(uniqueCode, bot, db, logger, matched);
          logger.info(`✅ QRIS paid: ${uniqueCode} amount=${deposit.amount}`);
        }
      }
    } catch (error) {
      logger.error('Error in checkQRISStatus:', error?.message || error);
    }
  }

  function startAutoTopupMutasi(bot, db, logger) {
    if (!isPrimaryInstance) {
      logger.info('ℹ️ Auto-topup mutasi nonaktif di instance non-primary (PM2 cluster).');
      return;
    }

    setInterval(() => {
      pollMutasi(bot, db, logger).catch((error) => {
        logger.error('❌ Unexpected pollMutasi error:', error?.message || error);
      });
    }, 2000);
    logger.info('✅ Auto-topup QRIS (mutasi) aktif.');
  }

  return { checkQRISStatus, startAutoTopupMutasi };
}

module.exports = { createQrisPendingDepositMonitorService };
