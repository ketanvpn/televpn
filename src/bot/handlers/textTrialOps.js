async function handleTextTrialOps(ctx, deps) {
  const {
    state,
    text,
    fs,
    logger,
    userState,
    getTrialConfig,
    getUserBalance,
    getUserFlagStatus,
    getTrialUsageToday,
    checkTrialAccess,
    trialvmess,
    trialvless,
    trialtrojan,
    trialshadowsocks,
    trialssh,
    recordAccountTransaction,
    saveTrialAccess,
  } = deps;

  if (!state.step.startsWith('username_trial_')) return false;

  try { await ctx.deleteMessage().catch(() => {}); } catch (e) {}

  const username = `trial${ctx.from.id}`;
  const idUser = String(ctx.from.id).trim();

  let data;
  try {
    data = await new Promise((resolve, reject) => {
      fs.readFile('./ressel.db', 'utf8', (err, content) => {
        if (err) return reject(err);
        resolve(content || '');
      });
    });
  } catch (err) {
    logger.error('❌ Gagal membaca file ressel.db:', err.message);
    await ctx.reply('❌ *Terjadi kesalahan saat membaca data reseller.*', { parse_mode: 'Markdown' });
    return true;
  }

  const resselList = data.split('\n').map((line) => line.trim()).filter(Boolean);
  const isRessel = resselList.includes(idUser);

  if (!isRessel) {
    const cfg = await getTrialConfig();
    const maxPerDay = (cfg && Number.isInteger(cfg.maxPerDay) && cfg.maxPerDay > 0) ? cfg.maxPerDay : 1;
    const minBalance = (cfg && Number.isInteger(cfg.minBalanceForTrial) && cfg.minBalanceForTrial > 0) ? cfg.minBalanceForTrial : 0;

    if (minBalance > 0) {
      const saldoUser = await getUserBalance(ctx.from.id);
      if (saldoUser < minBalance) {
        await ctx.reply(
          '❌ *Kamu belum memenuhi syarat saldo untuk memakai trial.*\n\n' +
          `• Minimal saldo untuk trial saat ini: *Rp${minBalance}*\n` +
          `• Saldo kamu saat ini              : *Rp${saldoUser}*\n\n` +
          'Silakan topup saldo terlebih dahulu lewat menu *💰 TopUp Saldo Otomatis / Manual via (QRIS)*,\n' +
          'lalu coba lagi fitur trial-nya.',
          { parse_mode: 'Markdown' }
        );
        return true;
      }
    }

    try {
      const flagStatus = await getUserFlagStatus(ctx.from.id);
      if (flagStatus === 'WATCHLIST') {
        const watchlistLimit = 1;
        const usedToday = await getTrialUsageToday(ctx.from.id);
        if (usedToday >= watchlistLimit) {
          await ctx.reply(
            '❌ *Batas trial harian untuk akun WATCHLIST sudah tercapai.*\n\n' +
            `Saat ini akun kamu berstatus *WATCHLIST* sehingga fitur trial hanya bisa dipakai *${watchlistLimit}x per hari*.\n` +
            'Silakan coba lagi besok, atau beli akun lewat menu *➕ Buat Akun*.',
            { parse_mode: 'Markdown' }
          );
          return true;
        }
      }
    } catch (e) {
      logger.error('⚠️ Gagal membaca flag_status user saat cek trial WATCHLIST:', e.message || e);
    }

    const sudahPakai = await checkTrialAccess(ctx.from.id);
    if (sudahPakai) {
      await ctx.reply(
        '❌ *Batas trial harian sudah tercapai.*\n\n' +
        `Saat ini trial hanya bisa dipakai *${maxPerDay}x per hari* untuk 1 user.\n` +
        'Silakan coba lagi besok, atau beli akun lewat menu *➕ Buat Akun*.',
        { parse_mode: 'Markdown' }
      );
      return true;
    }
  }

  const { type, serverId } = state;
  delete userState[ctx.chat.id];

  try {
    const cfg = await getTrialConfig();
    const durationHours = (cfg && Number.isInteger(cfg.durationHours) && cfg.durationHours > 0) ? cfg.durationHours : 1;

    const trialFunctions = {
      vmess: trialvmess,
      vless: trialvless,
      trojan: trialtrojan,
      shadowsocks: trialshadowsocks,
      ssh: trialssh,
    };

    if (trialFunctions[type]) {
      const msg = await trialFunctions[type](username, 'none', durationHours, 'none', serverId);
      await recordAccountTransaction(ctx.from.id, type);
      await saveTrialAccess(ctx.from.id);

      const extraInfo =
        '\n\nℹ️ *Catatan:*\n' +
        'Username dan password yang tampil di atas dibuat *acak otomatis oleh server*.\n' +
        'Teks yang kamu kirim tadi hanya dipakai sebagai konfirmasi, bukan sebagai username akun.';

      await ctx.reply(msg + extraInfo, { parse_mode: 'Markdown' });
      logger.info(`✅ Trial ${type} oleh ${ctx.from.id}`);
    }
  } catch (err) {
    logger.error('❌ Gagal proses trial akun:', err.message);
    await ctx.reply('❌ *Terjadi kesalahan saat memproses trial akun.*', { parse_mode: 'Markdown' });
  }

  return true;
}

module.exports = { handleTextTrialOps };
