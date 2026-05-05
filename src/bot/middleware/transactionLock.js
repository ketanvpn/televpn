const txLock = new Map();

function isTxAction(data = '') {
  return (
    data.startsWith('create_') ||
    data.startsWith('renew_') ||
    data.startsWith('trial_') ||
    data === 'topup_manual' ||
    data === 'topup_saldo'
  );
}

function transactionLockMiddleware() {
  return async (ctx, next) => {
    const userId = ctx.from?.id;
    const data = ctx.callbackQuery?.data || '';
    if (!userId || !isTxAction(data)) return next();

    const now = Date.now();
    const lock = txLock.get(userId);

    if (lock && now < lock.until) {
      await ctx.answerCbQuery(`⏳ Sedang diproses (${lock.action})`, { show_alert: false });
      return;
    }

    txLock.set(userId, { action: data, until: now + 25 * 1000 });

    try {
      await next();
    } finally {
      txLock.delete(userId);
    }
  };
}

module.exports = {
  isTxAction,
  transactionLockMiddleware,
};
