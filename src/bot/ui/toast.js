async function toast(ctx, text, { alert = false } = {}) {
  try {
    await ctx.answerCbQuery(text, { show_alert: alert });
  } catch (_) {}
}

async function toastError(ctx, text) {
  await toast(ctx, `⚠️ ${text}`);
}

module.exports = {
  toast,
  toastError,
};
