function createQrisPendingDepositMonitorService(deps) {
  const {
    globalState,
    fetchGopayTransactions,
    findMatchingSettlementTransaction,
    markDepositExpired,
    creditDeposit,
    qrisPaymentTimeoutMin,
  } = deps;

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
          await creditDeposit(uniqueCode, bot, db, logger);
          logger.info(`✅ QRIS paid: ${uniqueCode} amount=${deposit.amount}`);
        }
      }
    } catch (error) {
      logger.error('Error in checkQRISStatus:', error?.message || error);
    }
  }

  return { checkQRISStatus };
}

module.exports = { createQrisPendingDepositMonitorService };
