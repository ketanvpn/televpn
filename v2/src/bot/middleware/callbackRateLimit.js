const rateByUser = new Map();

function callbackRateLimit(windowMs = 700) {
  return async (ctx, next) => {
    if (!ctx.callbackQuery) return next();

    const userId = ctx.from && ctx.from.id;
    if (!userId) return next();

    const now = Date.now();
    const last = rateByUser.get(userId) || 0;
    if (now - last < windowMs) {
      try {
        await ctx.answerCbQuery('Please wait...');
      } catch (_) {}
      return;
    }

    rateByUser.set(userId, now);
    return next();
  };
}

module.exports = { callbackRateLimit };
