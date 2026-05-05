function createLicenseInfoGetter(getExpireDate) {
  return function getLicenseInfo() {
    const expireDate = getExpireDate();
    if (!expireDate) return null;

    const now = new Date();
    const expire = new Date(expireDate + 'T23:59:59');
    const diffMs = expire - now;
    const daysLeft = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    return { expire, daysLeft };
  };
}

function licenseGuardMiddleware({ getLicenseInfo, masterId }) {
  return async (ctx, next) => {
    const info = getLicenseInfo();
    if (!info) return next();

    if (info.daysLeft > 0) return next();

    if (ctx.from && ctx.from.id === masterId) return next();

    try {
      await ctx.reply(
        '⛔ *Bot sementara nonaktif karena lisensi sudah habis.*\n' +
        'Silakan hubungi owner untuk perpanjang.',
        { parse_mode: 'Markdown' }
      );
    } catch (e) {
      // Keep legacy behavior: failed notification must not crash the bot.
    }
  };
}

module.exports = {
  createLicenseInfoGetter,
  licenseGuardMiddleware,
};
