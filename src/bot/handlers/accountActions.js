const { getAccountsByUserCreatedBetween } = require('../../repositories/accountRepository');

function registerAccountActionHandlers(bot, deps) {
  const {
    sendMainMenu,
    ensurePrivateChat,
    isAdmin,
    adminIds,
    isResellerId,
    getResellerActiveBonusStats,
    logger,
    db,
    TIME_ZONE,
    RESELLER_TARGET_MIN_30D_ACCOUNTS,
    RESELLER_TARGET_MIN_DAYS_PER_MONTH,
    RESELLER_ACTIVE_BONUS_ENABLED,
    RESELLER_ACTIVE_BONUS_MIN_DURATION_DAYS,
    RESELLER_ACTIVE_BONUS_MIN_DAILY_OMZET,
    startSelectServer,
    getUserFlagStatus,
    userState,
    sendCleanMenu,
    getTrialConfig,
    DEFAULT_TRIAL_CONFIG,
  } = deps;

  bot.action('send_main_menu', async (ctx) => {
    if (!ctx || !ctx.match) {
      try {
        await ctx.answerCbQuery('❌ Terjadi kesalahan, silakan coba lagi.', { show_alert: true });
      } catch (e) {
        console.error('Gagal kirim callback error send_main_menu:', e.message);
      }
      return;
    }
    await sendMainMenu(ctx);
  });

  bot.action('sales_summary', async (ctx) => {
    await ctx.answerCbQuery().catch(() => {});

    if (!ensurePrivateChat(ctx)) return;
    if (!ctx.from) return;

    const userId = ctx.from.id;

    if (!isResellerId(userId) && !isAdmin(userId, adminIds)) {
      return ctx.reply(
        '❌ Fitur <b>Penjualan Saya</b> hanya untuk reseller.',
        { parse_mode: 'HTML' }
      );
    }

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1).getTime();
    const dayMs = 24 * 60 * 60 * 1000;

    let rows = [];
    try {
      rows = await getAccountsByUserCreatedBetween(db, userId, monthStart, monthEnd);
    } catch (err) {
      logger.error('Gagal ambil data penjualan reseller (sales_summary):', err.message || err);
      return ctx.reply('❌ Gagal memuat ringkasan penjualan kamu. Silakan coba lagi.', { parse_mode: 'HTML' });
    }

    const bonusStats = await getResellerActiveBonusStats(userId, { offsetMonths: 0 });
    const bulanLabel = now.toLocaleDateString('id-ID', {
      timeZone: TIME_ZONE,
      year: 'numeric',
      month: 'long',
    });

    let totalAccounts = 0;
    let totalDays = 0;
    let count30Days = 0;

    for (const acc of (rows || [])) {
      totalAccounts += 1;
      if (!acc.expires_at || !acc.created_at) continue;
      const durMs = acc.expires_at - acc.created_at;
      let durDays = Math.round(durMs / dayMs);
      if (durDays < 1) durDays = 1;
      totalDays += durDays;
      if (durDays >= 30) count30Days += 1;
    }

    const meets30 = count30Days >= RESELLER_TARGET_MIN_30D_ACCOUNTS;
    const meetsDays = totalDays >= RESELLER_TARGET_MIN_DAYS_PER_MONTH;

    let bonusProgressText = '';
    if (RESELLER_ACTIVE_BONUS_ENABLED) {
      bonusProgressText += `<b>📊 Progress Bonus Aktif</b>\n`;
      bonusProgressText += `• Hari aktif valid       : <b>${bonusStats.validActiveDays}</b> hari\n`;
      bonusProgressText += `• Akun valid bonus       : <b>${bonusStats.validAccounts}</b> akun\n`;
      bonusProgressText += `• Omzet valid estimasi   : <b>Rp${Number(bonusStats.validOmzet || 0).toLocaleString('id-ID')}</b>\n`;
      bonusProgressText += `• Min durasi dihitung    : <b>${RESELLER_ACTIVE_BONUS_MIN_DURATION_DAYS}</b> hari\n`;
      bonusProgressText += `• Min omzet / hari       : <b>Rp${Number(RESELLER_ACTIVE_BONUS_MIN_DAILY_OMZET || 0).toLocaleString('id-ID')}</b>\n`;
      if (bonusStats.currentTier) {
        bonusProgressText += `• Tier tercapai          : <b>${bonusStats.currentTier.label}</b> (Rp${Number(bonusStats.currentTier.bonusAmount || 0).toLocaleString('id-ID')})\n`;
      } else {
        bonusProgressText += `• Tier tercapai          : <b>Belum ada</b>\n`;
      }
      if (bonusStats.nextTier) {
        const need = Math.max(0, bonusStats.nextTier.minDays - bonusStats.validActiveDays);
        bonusProgressText += `• Target berikutnya      : <b>${bonusStats.nextTier.label}</b> — sisa <b>${need}</b> hari lagi\n`;
      } else if (bonusStats.currentTier) {
        bonusProgressText += `• Target berikutnya      : <b>Tier tertinggi sudah tercapai</b>\n`;
      }
      if (bonusStats.invalidShortAccounts > 0) {
        bonusProgressText += `• Akun terlalu pendek    : <b>${bonusStats.invalidShortAccounts}</b> akun tidak dihitung\n`;
      }
      if (bonusStats.invalidLowOmzetDays > 0) {
        bonusProgressText += `• Hari omzet kurang      : <b>${bonusStats.invalidLowOmzetDays}</b> hari tidak dihitung\n`;
      }
    }

    const text =
      `<b>📊 Penjualan Saya — ${bulanLabel}</b>\n\n` +
      `• Total akun terjual       : <b>${totalAccounts}</b>\n` +
      `• Akun durasi ≥ 30 hari    : <b>${count30Days}</b>\n` +
      `• Total hari akumulasi     : <b>${totalDays}</b> hari\n\n` +
      `<b>🎯 Target Bulanan</b>\n` +
      `• Minimal <b>${RESELLER_TARGET_MIN_30D_ACCOUNTS}</b> akun berdurasi ≥ 30 hari\n` +
      `• Atau total <b>${RESELLER_TARGET_MIN_DAYS_PER_MONTH}</b> hari dari semua akun\n\n` +
      `<b>📌 Status Target Bulan Ini</b>\n` +
      `• Target akun 30 hari : ${meets30 ? '✅ Tercapai' : '❌ Belum tercapai'}\n` +
      `• Target total hari   : ${meetsDays ? '✅ Tercapai' : '❌ Belum tercapai'}\n\n` +
      (RESELLER_ACTIVE_BONUS_ENABLED ? bonusProgressText + '\n' : '') +
      `<i>*Data ini dihitung dari akun yang dibuat pada bulan berjalan.</i>`;

    await ctx.reply(text, { parse_mode: 'HTML' });
  });

  const trialHandlers = [
    ['trial_vmess', 'vmess', 'TRIAL VMESS'],
    ['trial_vless', 'vless', 'TRIAL VLESS'],
    ['trial_trojan', 'trojan', 'TRIAL TROJAN'],
    ['trial_shadowsocks', 'shadowsocks', 'TRIAL SHADOWSOCKS'],
    ['trial_ssh', 'ssh', 'TRIAL SSH/OVPN'],
  ];

  for (const [actionName, type, label] of trialHandlers) {
    bot.action(actionName, async (ctx) => {
      if (!ctx || !ctx.match) {
        try {
          await ctx.answerCbQuery('❌ Terjadi kesalahan, silakan coba lagi.', { show_alert: true });
        } catch (e) {
          console.error(`Gagal kirim callback error ${actionName}:`, e.message);
        }
        return;
      }

      const userId = ctx.from.id;
      const flag = await getUserFlagStatus(userId);

      if (flag === 'NAKAL') {
        try {
          await ctx.answerCbQuery('⚠️ Akses trial kamu dibatasi.', { show_alert: true });
        } catch (e) {}
        await ctx.reply(
          `⚠️ Akun kamu saat ini berstatus <b>NAKAL</b>.\nFitur <b>${label}</b> tidak dapat digunakan.\nSilakan hubungi admin jika merasa ini salah.`,
          { parse_mode: 'HTML' }
        );
        return;
      }

      await startSelectServer(ctx, 'trial', type);
    });
  }

  const createHandlers = [
    ['create_vmess', 'vmess', 'BUAT AKUN VMESS'],
    ['create_vless', 'vless', 'BUAT AKUN VLESS'],
    ['create_trojan', 'trojan', 'BUAT AKUN TROJAN'],
    ['create_shadowsocks', 'shadowsocks', 'BUAT AKUN SHADOWSOCKS'],
    ['create_ssh', 'ssh', 'BUAT AKUN SSH/OVPN'],
  ];

  for (const [actionName, type, label] of createHandlers) {
    bot.action(actionName, async (ctx) => {
      if (!ctx || !ctx.match) {
        try {
          await ctx.answerCbQuery('❌ Terjadi kesalahan, silakan coba lagi.', { show_alert: true });
        } catch (e) {
          console.error(`Gagal kirim callback error ${actionName}:`, e.message);
        }
        return;
      }

      const userId = ctx.from.id;
      const flag = await getUserFlagStatus(userId);

      if (flag === 'NAKAL') {
        try {
          await ctx.answerCbQuery('⚠️ Akses buat akun kamu dibatasi.', { show_alert: true });
        } catch (e) {}

        await ctx.reply(
          `⚠️ Akun kamu saat ini berstatus <b>NAKAL</b>.\nFitur <b>${label}</b> tidak dapat digunakan.\nSilakan hubungi admin jika merasa ini salah.`,
          { parse_mode: 'HTML' }
        );
        return;
      }

      await startSelectServer(ctx, 'create', type);
    });
  }

  const deleteActions = [
    ['del_ssh', 'ssh'],
    ['del_vmess', 'vmess'],
    ['del_vless', 'vless'],
    ['del_trojan', 'trojan'],
  ];

  for (const [actionName, type] of deleteActions) {
    bot.action(actionName, async (ctx) => {
      if (!ctx || !ctx.match) {
        return ctx.reply('❌ *GAGAL!* Terjadi kesalahan saat memproses permintaan Anda. Silakan coba lagi nanti.', { parse_mode: 'Markdown' });
      }
      await startSelectServer(ctx, 'del', type);
    });
  }

  const lockActions = [
    ['lock_ssh', 'ssh'],
    ['lock_vmess', 'vmess'],
    ['lock_vless', 'vless'],
    ['lock_trojan', 'trojan'],
  ];

  for (const [actionName, type] of lockActions) {
    bot.action(actionName, async (ctx) => {
      if (!ctx || !ctx.match) {
        return ctx.reply('❌ *GAGAL!* Terjadi kesalahan saat memproses permintaan Anda. Silakan coba lagi nanti.', { parse_mode: 'Markdown' });
      }
      await startSelectServer(ctx, 'lock', type);
    });
  }

  const unlockActions = [
    ['unlock_ssh', 'ssh'],
    ['unlock_vmess', 'vmess'],
    ['unlock_vless', 'vless'],
    ['unlock_trojan', 'trojan'],
  ];

  for (const [actionName, type] of unlockActions) {
    bot.action(actionName, async (ctx) => {
      if (!ctx || !ctx.match) {
        return ctx.reply('❌ *GAGAL!* Terjadi kesalahan saat memproses permintaan Anda. Silakan coba lagi nanti.', { parse_mode: 'Markdown' });
      }
      await startSelectServer(ctx, 'unlock', type);
    });
  }

  const renewActions = [
    ['renew_vmess', 'vmess'],
    ['renew_vless', 'vless'],
    ['renew_trojan', 'trojan'],
    ['renew_shadowsocks', 'shadowsocks'],
    ['renew_ssh', 'ssh'],
  ];

  for (const [actionName, type] of renewActions) {
    bot.action(actionName, async (ctx) => {
      if (!ctx || !ctx.match) {
        try {
          await ctx.answerCbQuery('❌ Terjadi kesalahan, silakan coba lagi.', { show_alert: true });
        } catch (e) {
          console.error(`Gagal kirim callback error ${actionName}:`, e.message);
        }
        return;
      }
      await startSelectServer(ctx, 'renew', type);
    });
  }

  bot.action(/(create|renew)_username_(vmess|vless|trojan|shadowsocks|ssh)_(.+)/, async (ctx) => {
    const action = ctx.match[1];
    const type = ctx.match[2];
    const serverId = ctx.match[3];
    userState[ctx.chat.id] = { step: `username_${action}_${type}`, serverId, type, action };

    db.get('SELECT batas_create_akun, total_create_akun FROM Server WHERE id = ?', [serverId], async (err, server) => {
      if (err) {
        logger.error('❌ Error fetching server details:', err.message);
        return ctx.reply('❌ *Terjadi kesalahan saat mengambil detail server.*', { parse_mode: 'Markdown' });
      }

      if (!server) {
        return ctx.reply('❌ *Server tidak ditemukan.*', { parse_mode: 'Markdown' });
      }

      const batasCreateAkun = server.batas_create_akun;
      const totalCreateAkun = server.total_create_akun;

      if (totalCreateAkun >= batasCreateAkun) {
        return sendCleanMenu(
          ctx,
          '❌ <b>Server penuh.</b> Tidak dapat membuat akun baru di server ini.',
          { parse_mode: 'HTML' }
        );
      }

      await ctx.reply('👤 <b>Masukkan username:</b>', { parse_mode: 'HTML' });
    });
  });

  bot.action(/(trial)_username_(vmess|vless|trojan|shadowsocks|ssh)_(\d+)/, async (ctx) => {
    const [action, type, serverId] = [ctx.match[1], ctx.match[2], ctx.match[3]];

    db.get('SELECT * FROM Server WHERE id = ?', [serverId], async (err, server) => {
      if (err) {
        logger.error('❌ Gagal mengambil data server:', err.message);
        return ctx.reply('❌ Terjadi kesalahan saat mengambil data server.');
      }

      if (!server) {
        return ctx.reply('⚠️ Server tidak ditemukan di database.');
      }

      userState[ctx.chat.id] = {
        step: `username_${action}_${type}`,
        serverId,
        type,
        action,
        serverName: server.nama_server || server.domain,
      };

      let cfg;
      try {
        cfg = await getTrialConfig();
      } catch (e) {
        cfg = DEFAULT_TRIAL_CONFIG;
        logger.error('❌ Gagal membaca konfigurasi trial di konfirmasi server:', e.message || e);
      }

      let durationHours =
        cfg && Number.isInteger(cfg.durationHours) && cfg.durationHours > 0
          ? cfg.durationHours
          : DEFAULT_TRIAL_CONFIG.durationHours;

      let maxPerDay =
        cfg && Number.isInteger(cfg.maxPerDay) && cfg.maxPerDay > 0
          ? cfg.maxPerDay
          : DEFAULT_TRIAL_CONFIG.maxPerDay;

      let minBalance =
        cfg && Number.isInteger(cfg.minBalanceForTrial) && cfg.minBalanceForTrial > 0
          ? cfg.minBalanceForTrial
          : 0;

      const serverName = server.nama_server || server.domain || `ID ${server.id}`;

      let info =
        `⚠️ <b>Konfirmasi Trial ${type.toUpperCase()}</b>\n\n` +
        `Kamu akan membuat akun <b>trial ${type.toUpperCase()}</b> di server <b>${serverName}</b>.\n\n` +
        `<b>Pengaturan trial saat ini:</b>\n` +
        `• Masa aktif trial   : <b>${durationHours} jam</b>\n` +
        `• Batas trial / hari : <b>${maxPerDay}x per user</b>\n`;

      if (minBalance > 0) {
        info += `• Minimal saldo trial: <b>Rp${minBalance}</b>\n`;
      }

      info +=
        '\nUsername untuk akun trial akan dibuat <b>acak otomatis oleh server</b>.\n' +
        'Jadi kamu <b>tidak perlu menentukan username sendiri</b>.\n\n' +
        'Kalau setuju, balas pesan ini dengan teks apa saja (contoh: <code>ok</code>, <code>lanjut</code>, atau emoji).\n' +
        'Setelah itu bot akan langsung membuat akun trial dan menampilkan username & password yang dibuat otomatis.';

      await sendCleanMenu(ctx, info, { parse_mode: 'HTML' });
    });
  });

  bot.action(/(del|unlock|lock)_username_(vmess|vless|trojan|shadowsocks|ssh)_(.+)/, async (ctx) => {
    const [action, type, serverId] = [ctx.match[1], ctx.match[2], ctx.match[3]];

    userState[ctx.chat.id] = {
      step: `username_${action}_${type}`,
      serverId,
      type,
      action,
    };

    const prompt =
      action === 'del'
        ? '👤 *Masukkan username yang ingin dihapus:*'
        : action === 'unlock'
          ? '👤 *Masukkan username yang ingin dibuka:*'
          : '👤 *Masukkan username yang ingin dikunci:*';

    await ctx.reply(prompt, { parse_mode: 'Markdown' });
  });
}

module.exports = { registerAccountActionHandlers };
