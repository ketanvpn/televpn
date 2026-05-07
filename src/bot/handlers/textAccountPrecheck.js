async function runAccountPurchasePrecheck(ctx, deps) {
  const {
    state,
    db,
    logger,
    isUserReseller,
    RESELLER_DISCOUNT,
    getUserFlagStatus,
    getCreateUsageToday,
  } = deps;

  const serverId = state.serverId;
  const action = state.action;

  const server = await new Promise((resolve, reject) => {
    db.get('SELECT harga FROM Server WHERE id = ?', [serverId], (err, row) => {
      if (err) return reject(err);
      resolve(row);
    });
  }).catch(async (err) => {
    logger.error('⚠️ Error fetching server price:', err.message);
    await ctx.reply('❌ *Terjadi kesalahan saat mengambil harga server.*', { parse_mode: 'Markdown' });
    return null;
  });

  if (!server) return { ok: false };

  const baseHarga30 = Number(server.harga) || 0;
  const days = state.exp || 30;
  const isR = await isUserReseller(ctx.from.id).catch(() => false);

  let totalHarga = 0;
  if (baseHarga30 > 0) {
    totalHarga = Math.max(1, Math.floor((baseHarga30 * days) / 30));
    if (isR) totalHarga = Math.max(1, Math.floor(totalHarga * RESELLER_DISCOUNT));
  }

  const user = await new Promise((resolve, reject) => {
    db.get('SELECT saldo FROM users WHERE user_id = ?', [ctx.from.id], (err, row) => {
      if (err) return reject(err);
      resolve(row);
    });
  }).catch(async (err) => {
    logger.error('⚠️ Kesalahan saat mengambil saldo pengguna:', err.message);
    await ctx.reply('❌ *Terjadi kesalahan saat mengambil saldo pengguna.*', { parse_mode: 'Markdown' });
    return null;
  });

  if (!user) {
    await ctx.reply('❌ *Pengguna tidak ditemukan.*', { parse_mode: 'Markdown' });
    return { ok: false };
  }

  if (user.saldo < totalHarga) {
    await ctx.reply('❌ *Saldo Anda tidak mencukupi untuk melakukan transaksi ini.*', { parse_mode: 'Markdown' });
    return { ok: false };
  }

  if (action === 'create' && !isR) {
    try {
      const flagStatus = await getUserFlagStatus(ctx.from.id);
      if (flagStatus === 'WATCHLIST') {
        const watchlistCreateLimit = 3;
        const createdToday = await getCreateUsageToday(ctx.from.id);
        if (createdToday >= watchlistCreateLimit) {
          await ctx.reply(
            '❌ *Batas pembuatan akun harian untuk akun WATCHLIST sudah tercapai.*\n\n' +
              `Saat ini akun kamu berstatus *WATCHLIST* sehingga hanya boleh membuat *${watchlistCreateLimit} akun baru per hari*.\n` +
              'Silakan coba lagi besok, atau gunakan akun yang sudah ada / hubungi admin.',
            { parse_mode: 'Markdown' }
          );
          return { ok: false };
        }
      }
    } catch (e) {
      logger.error('⚠️ Gagal cek limit create user WATCHLIST:', e.message || e);
    }
  }

  return { ok: true, totalHarga };
}

module.exports = { runAccountPurchasePrecheck };
