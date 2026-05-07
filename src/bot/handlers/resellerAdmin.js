function registerResellerAdminHandlers(bot, deps) {
  const {
    isAdmin,
    adminIds,
    logger,
    renderResellerTargetMenu,
    renderResellerBonusMenu,
    getResellerTargetConfig,
    setResellerTargetConfig,
    getResellerBonusConfig,
    setResellerBonusConfig,
    getMonthRange,
    getEligibleResellerActiveBonusPreview,
    grantResellerActiveBonus,
    NO_ACCESS_MESSAGE,
    botApi,
  } = deps;

  const answerNoAccess = (ctx, text = '❌ *Menu ini khusus admin.*') =>
    ctx.reply(text, { parse_mode: 'Markdown' });

  const buildResellerMenuKeyboard = () => [
    [{ text: '➕ Tambah Server Reseller', callback_data: 'addserver_reseller' }],
    [
      { text: '➕ Tambah Saldo User', callback_data: 'tambah_saldo' },
      { text: '📜 Riwayat Saldo User', callback_data: 'riwayat_saldo_user' },
    ],
    [{ text: '📋 List Res & Member', callback_data: 'list_res_mem' }],
    [{ text: '🎯 Target Reseller', callback_data: 'admin_reseller_target' }],
    [{ text: '🎁 Bonus Reseller Aktif', callback_data: 'admin_reseller_bonus_menu' }],
    [{ text: '🧾 Upload Gambar QRIS', callback_data: 'upload_qris' }],
    [{ text: '🔙 Kembali ke Menu Admin', callback_data: 'admin_menu' }],
  ];

  bot.action('admin_reseller_menu', async (ctx) => {
    const adminId = ctx.from.id;
    if (!isAdmin(adminId, adminIds)) {
      return ctx.answerCbQuery('❌ Khusus admin.', { show_alert: true }).catch(() => {});
    }

    await ctx.answerCbQuery().catch(() => {});

    const text =
      '<b>📦 MENU RESELLER & SALDO</b>\n\n' +
      'Semua pengaturan yang berhubungan dengan reseller & saldo:\n\n' +
      '• Tambah server reseller\n' +
      '• Tambah saldo user / reseller\n' +
      '• Lihat riwayat saldo\n' +
      '• Lihat daftar reseller & member\n' +
      '• Upload QRIS untuk topup manual\n';

    const keyboard = buildResellerMenuKeyboard();

    try {
      await ctx.editMessageText(text, {
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: keyboard },
      });
    } catch (err) {
      logger.error('Error saat buka submenu reseller:', err.message || err);
      await ctx.reply(text, {
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: keyboard },
      });
    }
  });

  bot.action('admin_reseller_target', async (ctx) => {
    try { await ctx.answerCbQuery().catch(() => {}); } catch (err) {}
    if (!isAdmin(ctx.from?.id, adminIds)) {
      return answerNoAccess(ctx);
    }
    await renderResellerTargetMenu(ctx, { edit: false });
  });

  bot.action('admin_res_target_toggle', async (ctx) => {
    try { await ctx.answerCbQuery().catch(() => {}); } catch (err) {}
    if (!isAdmin(ctx.from?.id, adminIds)) return answerNoAccess(ctx);

    const cfg = getResellerTargetConfig();
    setResellerTargetConfig({ enabled: !cfg.enabled });
    await renderResellerTargetMenu(ctx, { edit: true });
  });

  bot.action('admin_res_target_min30_inc', async (ctx) => {
    try { await ctx.answerCbQuery().catch(() => {}); } catch (err) {}
    if (!isAdmin(ctx.from?.id, adminIds)) return answerNoAccess(ctx);

    const cfg = getResellerTargetConfig();
    const next = Math.max(1, Number(cfg.min30 || 0) + 1);
    setResellerTargetConfig({ min30: next });
    await renderResellerTargetMenu(ctx, { edit: true });
  });

  bot.action('admin_res_target_min30_dec', async (ctx) => {
    try { await ctx.answerCbQuery().catch(() => {}); } catch (err) {}
    if (!isAdmin(ctx.from?.id, adminIds)) return answerNoAccess(ctx);

    const cfg = getResellerTargetConfig();
    const next = Math.max(1, Number(cfg.min30 || 1) - 1);
    setResellerTargetConfig({ min30: next });
    await renderResellerTargetMenu(ctx, { edit: true });
  });

  bot.action('admin_res_target_days_inc', async (ctx) => {
    try { await ctx.answerCbQuery().catch(() => {}); } catch (err) {}
    if (!isAdmin(ctx.from?.id, adminIds)) return answerNoAccess(ctx);

    const cfg = getResellerTargetConfig();
    setResellerTargetConfig({ minDays: Number(cfg.minDays || 0) + 30 });
    await renderResellerTargetMenu(ctx, { edit: true });
  });

  bot.action('admin_res_target_days_dec', async (ctx) => {
    try { await ctx.answerCbQuery().catch(() => {}); } catch (err) {}
    if (!isAdmin(ctx.from?.id, adminIds)) return answerNoAccess(ctx);

    const cfg = getResellerTargetConfig();
    const next = Math.max(30, Number(cfg.minDays || 30) - 30);
    setResellerTargetConfig({ minDays: next });
    await renderResellerTargetMenu(ctx, { edit: true });
  });

  bot.action('admin_res_target_min30_nop', async (ctx) => {
    await ctx.answerCbQuery().catch(() => {});
  });

  bot.action('admin_res_target_days_nop', async (ctx) => {
    await ctx.answerCbQuery().catch(() => {});
  });

  bot.action('admin_reseller_bonus_menu', async (ctx) => {
    try { await ctx.answerCbQuery().catch(() => {}); } catch (err) {}
    if (!isAdmin(ctx.from?.id, adminIds)) return answerNoAccess(ctx);
    await renderResellerBonusMenu(ctx, { edit: false });
  });

  bot.action('admin_res_bonus_nop', async (ctx) => {
    await ctx.answerCbQuery().catch(() => {});
  });

  bot.action('admin_res_bonus_toggle', async (ctx) => {
    await ctx.answerCbQuery().catch(() => {});
    if (!isAdmin(ctx.from?.id, adminIds)) return answerNoAccess(ctx);

    const cfg = getResellerBonusConfig();
    setResellerBonusConfig({ enabled: !cfg.enabled });
    await renderResellerBonusMenu(ctx, { edit: true });
  });

  function clampBonusConfig(cfg) {
    const next = { ...cfg };
    if (next.minDurationDays < 1) next.minDurationDays = 1;
    if (next.minDailyOmzet < 0) next.minDailyOmzet = 0;
    if (next.tier1Days < 1) next.tier1Days = 1;
    if (next.tier2Days <= next.tier1Days) next.tier2Days = next.tier1Days + 1;
    if (next.tier3Days <= next.tier2Days) next.tier3Days = next.tier2Days + 1;
    if (next.tier1Amount < 1000) next.tier1Amount = 1000;
    if (next.tier2Amount < next.tier1Amount) next.tier2Amount = next.tier1Amount;
    if (next.tier3Amount < next.tier2Amount) next.tier3Amount = next.tier2Amount;
    return next;
  }

  async function updateBonusAndRender(ctx, patch) {
    const current = clampBonusConfig(getResellerBonusConfig());
    setResellerBonusConfig({ ...current, ...patch });
    await renderResellerBonusMenu(ctx, { edit: true });
  }

  bot.action('admin_res_bonus_mindur_inc', async (ctx) => {
    await ctx.answerCbQuery().catch(() => {});
    await updateBonusAndRender(ctx, { minDurationDays: getResellerBonusConfig().minDurationDays + 1 });
  });
  bot.action('admin_res_bonus_mindur_dec', async (ctx) => {
    await ctx.answerCbQuery().catch(() => {});
    await updateBonusAndRender(ctx, { minDurationDays: getResellerBonusConfig().minDurationDays - 1 });
  });
  bot.action('admin_res_bonus_omzet_inc', async (ctx) => {
    await ctx.answerCbQuery().catch(() => {});
    await updateBonusAndRender(ctx, { minDailyOmzet: getResellerBonusConfig().minDailyOmzet + 5000 });
  });
  bot.action('admin_res_bonus_omzet_dec', async (ctx) => {
    await ctx.answerCbQuery().catch(() => {});
    await updateBonusAndRender(ctx, { minDailyOmzet: getResellerBonusConfig().minDailyOmzet - 5000 });
  });

  for (const tier of ['t1', 't2', 't3']) {
    bot.action(`admin_res_bonus_${tier}_days_inc`, async (ctx) => {
      await ctx.answerCbQuery().catch(() => {});
      const cfg = getResellerBonusConfig();
      const key = `${tier}Days`;
      await updateBonusAndRender(ctx, { [key]: cfg[key] + 1 });
    });
    bot.action(`admin_res_bonus_${tier}_days_dec`, async (ctx) => {
      await ctx.answerCbQuery().catch(() => {});
      const cfg = getResellerBonusConfig();
      const key = `${tier}Days`;
      await updateBonusAndRender(ctx, { [key]: cfg[key] - 1 });
    });
    bot.action(`admin_res_bonus_${tier}_amt_inc`, async (ctx) => {
      await ctx.answerCbQuery().catch(() => {});
      const cfg = getResellerBonusConfig();
      const key = `${tier}Amount`;
      await updateBonusAndRender(ctx, { [key]: cfg[key] + 5000 });
    });
    bot.action(`admin_res_bonus_${tier}_amt_dec`, async (ctx) => {
      await ctx.answerCbQuery().catch(() => {});
      const cfg = getResellerBonusConfig();
      const key = `${tier}Amount`;
      await updateBonusAndRender(ctx, { [key]: cfg[key] - 5000 });
    });
  }

  bot.action('admin_res_bonus_preview', async (ctx) => {
    await ctx.answerCbQuery().catch(() => {});
    if (!isAdmin(ctx.from?.id, adminIds)) return answerNoAccess(ctx);

    try {
      const monthInfo = getMonthRange(-1);
      const preview = await getEligibleResellerActiveBonusPreview(-1);

      if (!preview.length) {
        return ctx.reply(
          `ℹ️ Belum ada reseller yang lolos bonus aktif untuk periode *${monthInfo.label}*.`,
          { parse_mode: 'Markdown' }
        );
      }

      const lines = [];
      lines.push(`👀 *Preview Bonus Reseller Aktif*`);
      lines.push(`Periode: *${monthInfo.label}*`);
      lines.push('');

      preview.slice(0, 25).forEach((item, idx) => {
        const processedMark = item.processed ? ' • SUDAH DIPROSES' : '';
        lines.push(
          `${idx + 1}. \`${item.userId}\` — *${item.validActiveDays} hari* — ` +
          `omzet ~ *Rp${Number(item.validOmzet || 0).toLocaleString('id-ID')}* — ` +
          `${item.currentTier.label}: *Rp${Number(item.currentTier.bonusAmount || 0).toLocaleString('id-ID')}*${processedMark}`
        );
      });

      if (preview.length > 25) {
        lines.push('');
        lines.push(`_Menampilkan 25 dari total ${preview.length} reseller yang lolos._`);
      }

      await ctx.reply(lines.join('\n'), { parse_mode: 'Markdown' });
    } catch (err) {
      logger.error('Gagal preview bonus reseller:', err.message || err);
      await ctx.reply('❌ Gagal membuat preview bonus reseller.');
    }
  });

  bot.action('admin_res_bonus_process', async (ctx) => {
    await ctx.answerCbQuery().catch(() => {});
    if (!isAdmin(ctx.from?.id, adminIds)) return answerNoAccess(ctx);

    const cfg = getResellerBonusConfig();
    if (!cfg.enabled) {
      return ctx.reply('⚠️ Bonus reseller aktif sedang nonaktif. Aktifkan dulu dari menu bonus reseller.', { parse_mode: 'Markdown' });
    }

    try {
      const monthInfo = getMonthRange(-1);
      const preview = await getEligibleResellerActiveBonusPreview(-1);
      let successCount = 0;
      let skipCount = 0;
      let totalBonus = 0;

      for (const item of preview) {
        if (item.processed || !item.currentTier) {
          skipCount += 1;
          continue;
        }
        const result = await grantResellerActiveBonus({
          userId: item.userId,
          monthKey: item.monthKey,
          activeDays: item.validActiveDays,
          bonusAmount: item.currentTier.bonusAmount,
          tierLabel: item.currentTier.label,
          processedBy: ctx.from.id,
        });

        if (result.ok) {
          successCount += 1;
          totalBonus += Number(item.currentTier.bonusAmount || 0);
          try {
            await botApi.telegram.sendMessage(
              item.userId,
              `🎁 <b>Bonus Reseller Aktif Cair</b>\n\n` +
              `Periode: <b>${monthInfo.label}</b>\n` +
              `Hari aktif valid: <b>${item.validActiveDays}</b> hari\n` +
              `Tier bonus: <b>${item.currentTier.label}</b>\n` +
              `Bonus saldo: <b>Rp${Number(item.currentTier.bonusAmount || 0).toLocaleString('id-ID')}</b>\n\n` +
              `Terima kasih sudah aktif jualan. Semangat closing lagi ya 🔥`,
              { parse_mode: 'HTML' }
            );
          } catch (e) {}
        } else {
          skipCount += 1;
        }
      }

      await ctx.reply(
        `✅ *Proses bonus reseller selesai*\n\n` +
        `Periode : *${monthInfo.label}*\n` +
        `Berhasil: *${successCount}* reseller\n` +
        `Skip    : *${skipCount}* reseller\n` +
        `Total   : *Rp${Number(totalBonus || 0).toLocaleString('id-ID')}*`,
        { parse_mode: 'Markdown' }
      );
    } catch (err) {
      logger.error('Gagal proses bonus reseller:', err.message || err);
      await ctx.reply('❌ Gagal memproses bonus reseller.');
    }
  });
}

module.exports = {
  registerResellerAdminHandlers,
};
