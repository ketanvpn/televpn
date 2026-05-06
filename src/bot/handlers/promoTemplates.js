async function getBotTagForPromo(bot, logger) {
  let botTag = '@BOT_KAMU';
  try {
    const me = await bot.telegram.getMe();
    if (me && me.username) {
      botTag = '@' + me.username;
    }
  } catch (e) {
    logger.error('Gagal ambil info bot untuk template promosi:', e.message);
  }
  return botTag;
}

function registerPromoTemplateHandlers(bot, deps) {
  const {
    isAdmin,
    adminIds,
    logger,
  } = deps;

  bot.action('promo_template_menu', async (ctx) => {
    try { await ctx.answerCbQuery().catch(() => {}); } catch (e) {}

    if (!isAdmin(ctx.from?.id, adminIds)) {
      return ctx.reply('🚫 Menu ini khusus admin.');
    }

    const keyboard = [
      [{ text: '📜 Katalog Paket VPN', callback_data: 'promo_tpl_catalog' }],
      [{ text: '💎 Open Reseller', callback_data: 'promo_tpl_reseller' }],
      [{ text: '⚡ Promo Singkat Bot', callback_data: 'promo_tpl_short' }],
      [{ text: '👑 Template Kaisar', callback_data: 'promo_tpl_kaisar' }],
      [{ text: '🔙 Kembali ke Menu Admin', callback_data: 'admin_menu' }],
    ];

    const text =
      '<b>📢 TEMPLATE PROMOSI</b>\n\n' +
      'Pilih template yang ingin dipakai.\n' +
      'Bot akan kirim teks iklan siap copas, ' +
      'bisa kamu edit dulu sebelum dikirim ke channel / grup.';

    try {
      await ctx.editMessageText(text, {
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: keyboard },
      });
    } catch (err) {
      await ctx.reply(text, {
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: keyboard },
      });
    }
  });

  bot.action('promo_tpl_catalog', async (ctx) => {
    try { await ctx.answerCbQuery().catch(() => {}); } catch (e) {}

    if (!isAdmin(ctx.from?.id, adminIds)) return;

    const botTag = await getBotTagForPromo(bot, logger);
    const text =
      '╭─❖  N A M A  S T O R E  ❖\n' +
      '│ 🔐 Pasti Aman ⚡ Anti Ngebug\n' +
      '╰───────────────────────╮\n' +
      '   ✨ READY CONFIG PREMIUM ✨\n' +
      '╭───────────────────────╯\n' +
      '│ 🔰 SSH WS / UDP\n' +
      '│ 🔰 XRAY VMESS WS & GRPC\n' +
      '│ 🔰 XRAY VLESS WS & GRPC\n' +
      '│ 🔰 TROJAN WS & GRPC\n' +
      '╰───────────────────────╮\n' +
      '   🌍 PILIH LOKASI SERVER\n' +
      '╭───────────────────────╯\n' +
      '│ 🇸🇬 SG DIGITALOCEAN\n' +
      '│   Rp. 10.000 / 30 Hari • 2 Device\n' +
      '│ 🇮🇩 ID NUSA\n' +
      '│   Rp. 12.000 / 30 Hari • 2 Device\n' +
      '│ 🇮🇩 ID RAJASA\n' +
      '│   Rp. 13.000 / 30 Hari • 2 Device\n' +
      '│ 🇮🇩 ID MSA\n' +
      '│   Rp. 12.000 / 30 Hari • 2 Device\n' +
      '│ 🌏 Lokasi lain bisa request\n' +
      '╰───────────────────────────┈❁\n' +
      '\n' +
      '✅ Anti Lag • Stabil Harian\n' +
      '✅ Cocok Game / Streaming / Zoom\n' +
      '✅ Bisa Trial dulu sebelum beli\n' +
      '\n' +
      '📩 Order via bot:\n' +
      '👉 ' + botTag;

    await ctx.reply(text);
  });

  bot.action('promo_tpl_reseller', async (ctx) => {
    try { await ctx.answerCbQuery().catch(() => {}); } catch (e) {}

    if (!isAdmin(ctx.from?.id, adminIds)) return;

    const botTag = await getBotTagForPromo(bot, logger);
    const text =
      '╭━━━❖  OPEN RESELLER VPN  ❖━━━╮\n' +
      '┃  Saatnya cuan dari jualan akun 💸\n' +
      '╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯\n\n' +
      '✨ HARGA RESELLER MULAI:\n' +
      '• Dari Rp. 4.500 / akun\n' +
      '• Bot auto create akun 24 jam\n' +
      '• Banyak pilihan server premium\n' +
      '• Trial bisa kapan saja\n\n' +
      '💳 HARGA MEMBER MULAI:\n' +
      '• Rp. 10.000 / bulan\n' +
      '• Support 2 Device\n\n' +
      '🧾 JOIN RESELLER:\n' +
      '• Minimal deposit: Rp. 25.000\n' +
      '• Sistem saldo, tinggal klik akun jadi\n\n' +
      '🎯 KEUNGGULAN:\n' +
      '• Panel dan bot mudah dipahami\n' +
      '• Bebas tentukan harga jual sendiri\n\n' +
      '📲 Minat daftar reseller?\n' +
      'Order langsung via bot:\n' +
      '👉 ' + botTag;

    await ctx.reply(text);
  });

  bot.action('promo_tpl_short', async (ctx) => {
    try { await ctx.answerCbQuery().catch(() => {}); } catch (e) {}

    if (!isAdmin(ctx.from?.id, adminIds)) return;

    const botTag = await getBotTagForPromo(bot, logger);
    const text =
      '╭────────❖  VPN AUTO ORDER  ❖────────╮\n' +
      '│   Bot siap melayani 24 jam non-stop ⚡\n' +
      '╰─────────────────────────────────────╯\n\n' +
      '🚀 PROTOKOL:\n' +
      '• SSH & UDP\n' +
      '• VMESS • VLESS • TROJAN\n\n' +
      '🌍 SERVER:\n' +
      '• 🇸🇬 Singapore\n' +
      '• 🇮🇩 Indonesia\n\n' +
      '💎 KEUNGGULAN:\n' +
      '• Banyak promo menarik\n' +
      '• Speed kencang dan stabil\n' +
      '• Akun langsung jadi tanpa tunggu admin\n' +
      '• Garansi sesuai masa aktif\n\n' +
      '🤖 Order otomatis di bot:\n' +
      '👉 ' + botTag;

    await ctx.reply(text);
  });

  bot.action('promo_tpl_kaisar', async (ctx) => {
    try { await ctx.answerCbQuery().catch(() => {}); } catch (e) {}

    if (!isAdmin(ctx.from?.id, adminIds)) return;

    const botTag = await getBotTagForPromo(bot, logger);
    const text =
      '👑 NAMA STORE KAMU 👑\n' +
      '──────────────────────────\n' +
      'AKUN PREMIUM INDONESIA 🇮🇩\n\n' +
      '🇮🇩 ID CLOUD 1  :  Rp. 8K\n' +
      '🇮🇩 ID CLOUD 2  :  Rp. 8K\n' +
      '🇮🇩 ID CLOUD 3  :  Rp. 8K\n' +
      '🇮🇩 ID HERZA 1  :  Rp. 8K\n' +
      '🇮🇩 ID HERZA 2  :  Rp. 8K\n' +
      '──────────────────────────\n' +
      'TERSEDIA:\n' +
      '🛰 SSH\n' +
      '🛰 VMESS\n' +
      '🛰 SSH UDP\n' +
      '──────────────────────────\n' +
      '✅ Wajib trial dulu biar makin yakin\n' +
      '✅ Support 2 device\n' +
      '✅ Support STB / HP / Laptop\n\n' +
      '💳 Pembayaran:\n' +
      '✅ DANA\n' +
      '✅ OVO\n' +
      '✅ QRIS (All Payment)\n\n' +
      '📞 Order / tanya tanya via bot:\n' +
      '👉 ' + botTag;

    await ctx.reply(text);
  });
}

module.exports = {
  registerPromoTemplateHandlers,
};
