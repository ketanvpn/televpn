function registerBroadcastMenuHandlers(bot, deps) {
  const {
    isAdmin,
    adminIds,
    logger,
    broadcastSessions,
    sendBroadcastFromMenu,
    NO_ACCESS_MESSAGE,
  } = deps;

  async function handleBroadcastTargetFromMenu(ctx, target) {
    try {
      await ctx.answerCbQuery().catch(() => {});
    } catch (e) {}

    if (!ctx.from) return;
    const adminId = ctx.from.id;

    if (!isAdmin(adminId, adminIds)) {
      return ctx.reply(NO_ACCESS_MESSAGE, { parse_mode: 'HTML' });
    }

    let targetLabel = 'semua user';
    if (target === 'reseller') targetLabel = 'semua reseller';
    else if (target === 'member') targetLabel = 'member (bukan reseller & bukan admin)';

    broadcastSessions[adminId] = {
      step: 'choose_mode',
      target,
    };

    await ctx.reply(
      `📢 Pengumuman ke <b>${targetLabel}</b>\n\n` +
        'Pilih cara membuat pengumuman:\n' +
        '• ✍️ Tulis manual (ketik bebas)\n' +
        '• 🔧 Template Maintenance VPN\n' +
        '• 🏷 Template Promo/Diskon VPN',
      {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [{ text: '✍️ Tulis Manual', callback_data: 'broadcast_mode_manual' }],
            [{ text: '🔧 Maintenance VPN', callback_data: 'broadcast_mode_maintenance' }],
            [{ text: '🏷 Promo / Diskon', callback_data: 'broadcast_mode_promo' }],
            [{ text: '❌ Batal', callback_data: 'broadcast_cancel' }],
          ],
        },
      }
    );
  }

  bot.action('broadcast_menu', async (ctx) => {
    try {
      await ctx.answerCbQuery().catch(() => {});
    } catch (e) {}

    if (!ctx.from) return;

    const adminId = ctx.from.id;
    if (!isAdmin(adminId, adminIds)) {
      return ctx.reply(NO_ACCESS_MESSAGE, { parse_mode: 'HTML' });
    }

    broadcastSessions[adminId] = { step: 'choose_target' };

    const text =
      '📢 <b>Kirim Pengumuman</b>\n\n' +
      'Silakan pilih target pengumuman:\n' +
      '• 👥 Semua User\n' +
      '• 🧑‍💼 Reseller\n' +
      '• 👤 Member (bukan reseller & bukan admin)\n\n' +
      'Setelah pilih target, kirim teks pengumuman di chat ini.';

    const keyboard = [
      [{ text: '👥 Semua User', callback_data: 'broadcast_target_all' }],
      [{ text: '🧑‍💼 Reseller', callback_data: 'broadcast_target_reseller' }, { text: '👤 Member', callback_data: 'broadcast_target_member' }],
      [{ text: '🔙 Kembali ke Menu Admin', callback_data: 'admin_menu' }],
    ];

    return ctx.reply(text, {
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: keyboard },
    });
  });

  bot.action('broadcast_mode_manual', async (ctx) => {
    try { await ctx.answerCbQuery().catch(() => {}); } catch (e) {}

    if (!ctx.from) return;
    const adminId = ctx.from.id;

    if (!isAdmin(adminId, adminIds)) {
      return ctx.reply(NO_ACCESS_MESSAGE, { parse_mode: 'HTML' });
    }

    const state = broadcastSessions[adminId];
    if (!state || !state.target) {
      return ctx.reply('ℹ️ Tidak ada sesi pengumuman yang aktif. Mulai dari menu 📢 lagi.');
    }

    state.step = 'wait_message';

    await ctx.reply(
      '✍️ Silakan kirim teks pengumuman yang ingin dikirim.\n' +
        '• Kalau ingin batal, kirim perintah lain (misalnya /start).',
      { parse_mode: 'HTML' }
    );
  });

  bot.action('broadcast_mode_maintenance', async (ctx) => {
    try { await ctx.answerCbQuery().catch(() => {}); } catch (e) {}

    if (!ctx.from) return;
    const adminId = ctx.from.id;

    if (!isAdmin(adminId, adminIds)) {
      return ctx.reply(NO_ACCESS_MESSAGE, { parse_mode: 'HTML' });
    }

    const state = broadcastSessions[adminId];
    if (!state || !state.target) {
      return ctx.reply('ℹ️ Tidak ada sesi pengumuman yang aktif. Mulai dari menu 📢 lagi.');
    }

    state.step = 'tm_ask_layanan';

    await ctx.reply(
      '🔧 Template Maintenance VPN\n\n' +
        '1️⃣ Masukkan nama server atau layanan yang terkena maintenance.\n' +
        'Contoh:\n' +
        '• Semua server VPN\n' +
        '• Server SG-1 & SG-2\n' +
        '• Layanan SSH & VMESS',
      { parse_mode: 'HTML' }
    );
  });

  bot.action('broadcast_mode_promo', async (ctx) => {
    try { await ctx.answerCbQuery().catch(() => {}); } catch (e) {}

    if (!ctx.from) return;
    const adminId = ctx.from.id;

    if (!isAdmin(adminId, adminIds)) {
      return ctx.reply(NO_ACCESS_MESSAGE, { parse_mode: 'HTML' });
    }

    const state = broadcastSessions[adminId];
    if (!state || !state.target) {
      return ctx.reply('ℹ️ Tidak ada sesi pengumuman yang aktif. Mulai dari menu 📢 lagi.');
    }

    state.step = 'promo_ask_paket';

    await ctx.reply(
      '🏷 Template Promo / Diskon VPN\n\n' +
        '1️⃣ Masukkan nama paket atau jenis promo.\n' +
        'Contoh:\n' +
        '• Paket 30 Hari All Server\n' +
        '• Promo Akhir Bulan 7 Hari\n' +
        '• Diskon 30% semua paket bulanan',
      { parse_mode: 'HTML' }
    );
  });

  bot.action('broadcast_target_all', async (ctx) => {
    return handleBroadcastTargetFromMenu(ctx, 'all');
  });

  bot.action('broadcast_target_reseller', async (ctx) => {
    return handleBroadcastTargetFromMenu(ctx, 'reseller');
  });

  bot.action('broadcast_target_member', async (ctx) => {
    return handleBroadcastTargetFromMenu(ctx, 'member');
  });

  bot.action('broadcast_confirm', async (ctx) => {
    try {
      await ctx.answerCbQuery().catch(() => {});
    } catch (e) {}

    if (!ctx.from) return;
    const adminId = ctx.from.id;

    const state = broadcastSessions[adminId];
    if (!state || state.step !== 'confirm' || !state.message || !state.target) {
      return ctx.reply('ℹ️ Tidak ada pengumuman yang menunggu konfirmasi.');
    }

    const target = state.target;
    const message = state.message;

    delete broadcastSessions[adminId];

    await ctx.reply('⏳ Mengirim pengumuman, mohon tunggu...');
    await sendBroadcastFromMenu(ctx, target, message);
  });

  bot.action('broadcast_cancel', async (ctx) => {
    try {
      await ctx.answerCbQuery().catch(() => {});
    } catch (e) {}

    if (!ctx.from) return;
    const adminId = ctx.from.id;

    if (broadcastSessions[adminId]) {
      delete broadcastSessions[adminId];
    }

    await ctx.reply('❌ Pengumuman dibatalkan.');
  });
}

module.exports = {
  registerBroadcastMenuHandlers,
};
