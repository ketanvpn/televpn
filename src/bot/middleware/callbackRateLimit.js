const cbRateLimit = new Map();
const cbSameDataLock = new Map();

function startCallbackRateLimitCleanup() {
  return setInterval(() => {
    const now = Date.now();
    for (const [key, ts] of cbRateLimit) {
      if (now - ts > 5 * 60 * 1000) cbRateLimit.delete(key);
    }
    for (const [key, ts] of cbSameDataLock) {
      if (now - ts > 5 * 60 * 1000) cbSameDataLock.delete(key);
    }
  }, 5 * 60 * 1000);
}

function callbackRateLimitMiddleware() {
  return async (ctx, next) => {
    try {
      const userId = ctx.from?.id;
      const data = ctx.callbackQuery?.data || '';
      const now = Date.now();

      if (!userId) return next();

      const lastAny = cbRateLimit.get(userId) || 0;
      if (now - lastAny < 700) {
        await ctx.answerCbQuery('Pelan-pelan ya…');
        return;
      }
      cbRateLimit.set(userId, now);

      const key = `${userId}:${data}`;
      const lastSame = cbSameDataLock.get(key) || 0;
      if (now - lastSame < 1500) {
        await ctx.answerCbQuery('Sedang diproses…');
        return;
      }
      cbSameDataLock.set(key, now);

      return next();
    } catch (e) {
      try { await ctx.answerCbQuery(); } catch (_) {}
      return next();
    }
  };
}

module.exports = {
  startCallbackRateLimitCleanup,
  callbackRateLimitMiddleware,
};
