const {
  getAccountById,
  getAccountDetailWithServerById,
  deleteAccountById,
} = require('../../repositories/accountRepository');

function registerMyAccountDetailHandlers(bot, deps) {
  const {
    db,
    logger,
    sendCleanMenu,
    getAccountDaysLeft,
    userState,
    recordAccountTransaction,
    delvmess,
    delvless,
    deltrojan,
    delshadowsocks,
    delssh,
    lockvmess,
    lockvless,
    locktrojan,
    lockshadowsocks,
    lockssh,
    unlockvmess,
    unlockvless,
    unlocktrojan,
    unlockshadowsocks,
    unlockssh,
  } = deps;

  bot.action(/accsel:(\d+)/, async (ctx) => {
    try {
      await ctx.answerCbQuery().catch(() => {});
    } catch (e) {}

    if (!ctx.from) return ctx.reply('❌ Tidak bisa membaca data pengguna.');

    const userId = ctx.from.id;
    const accountId = parseInt(ctx.match[1], 10);
    if (!accountId) return ctx.reply('❌ ID akun tidak valid.');

    try {
      const row = await getAccountDetailWithServerById(db, accountId);

      if (!row || row.user_id !== userId) {
        return ctx.reply('❌ Akun ini tidak ditemukan atau bukan milik kamu.');
      }

      const serverName = row.nama_server || (row.server_id ? `Server ${row.server_id}` : 'Server ?');

      let status = '⏳ Tidak diketahui';
      if (row.expires_at) {
        const daysLeft = getAccountDaysLeft(row.expires_at);
        if (daysLeft > 0) status = `✅ Aktif (~${daysLeft} hari lagi)`;
        else if (daysLeft === 0) status = '⚠️ Aktif (habis HARI INI)';
        else status = '❌ Sudah expired';
      }

      const detail =
        '📄 <b>Detail Akun</b>\n\n' +
        `Tipe    : <b>${row.type}</b>\n` +
        `Username: <b>${row.username}</b>\n` +
        `Server  : ${serverName}\n` +
        `Status  : ${status}\n\n` +
        'Pilih aksi yang ingin kamu lakukan:';

      const keyboard = [
        [{ text: '➡️ Perpanjang Akun', callback_data: `accrenew:${row.id}` }],
        [{ text: '❌ Hapus Akun', callback_data: `accdel:${row.id}` }],
        [
          { text: '🔒 Kunci Akun', callback_data: `acclock:${row.id}` },
          { text: '🔓 Buka Kunci', callback_data: `accunlock:${row.id}` },
        ],
        [{ text: '🔙 Kembali ke daftar', callback_data: 'my_accounts' }],
      ];

      return sendCleanMenu(ctx, detail, {
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: keyboard },
      });
    } catch (err) {
      logger.error('Kesalahan saat mengambil detail akun:', err.message);
      return ctx.reply('❌ Terjadi kesalahan saat membaca detail akun.');
    }
  });

  bot.action(/accdel:(\d+)/, async (ctx) => {
    try {
      await ctx.answerCbQuery().catch(() => {});
    } catch (e) {}

    if (!ctx.from) return ctx.reply('❌ Tidak bisa membaca data pengguna.');

    const userId = ctx.from.id;
    const accountId = parseInt(ctx.match[1], 10);
    if (!accountId) return ctx.reply('❌ ID akun tidak valid.');

    try {
      const row = await getAccountById(db, accountId);

      if (!row || row.user_id !== userId) {
        return ctx.reply('❌ Akun ini tidak ditemukan atau bukan milik kamu.');
      }

      const delFunctions = {
        vmess: delvmess,
        vless: delvless,
        trojan: deltrojan,
        shadowsocks: delshadowsocks,
        ssh: delssh,
      };

      const fn = delFunctions[row.type];
      if (!fn) return ctx.reply('❌ Tipe akun tidak dikenal, tidak bisa dihapus.');

      try {
        const msg = await fn(row.username, 'none', 'none', 'none', row.server_id);
        await recordAccountTransaction(userId, row.type);

        await deleteAccountById(db, accountId).catch((err2) => {
          logger.error('Kesalahan menghapus record dari tabel accounts:', err2.message);
        });

        await ctx.reply(msg, { parse_mode: 'Markdown' });
        logger.info(`✅ Akun ${row.type} (${row.username}) dihapus lewat Akun Saya oleh ${userId}`);
      } catch (e2) {
        logger.error('❌ Gagal hapus akun dari menu Akun Saya:', e2.message);
        await ctx.reply('❌ *Terjadi kesalahan saat menghapus akun.*', { parse_mode: 'Markdown' });
      }
    } catch (err) {
      logger.error('Kesalahan saat mengambil akun untuk hapus:', err.message);
      return ctx.reply('❌ Terjadi kesalahan saat membaca data akun.');
    }
  });

  bot.action(/acclock:(\d+)/, async (ctx) => {
    try {
      await ctx.answerCbQuery().catch(() => {});
    } catch (e) {}

    if (!ctx.from) return ctx.reply('❌ Tidak bisa membaca data pengguna.');

    const userId = ctx.from.id;
    const accountId = parseInt(ctx.match[1], 10);
    if (!accountId) return ctx.reply('❌ ID akun tidak valid.');

    try {
      const row = await getAccountById(db, accountId);

      if (!row || row.user_id !== userId) {
        return ctx.reply('❌ Akun ini tidak ditemukan atau bukan milik kamu.');
      }

      const lockFunctions = {
        vmess: lockvmess,
        vless: lockvless,
        trojan: locktrojan,
        shadowsocks: lockshadowsocks,
        ssh: lockssh,
      };

      const fn = lockFunctions[row.type];
      if (!fn) return ctx.reply('❌ Tipe akun tidak dikenal, tidak bisa dikunci.');

      try {
        const msg = await fn(row.username, 'none', 'none', 'none', row.server_id);
        await recordAccountTransaction(userId, row.type);
        await ctx.reply(msg, { parse_mode: 'Markdown' });
        logger.info(`✅ Akun ${row.type} (${row.username}) dikunci lewat Akun Saya oleh ${userId}`);
      } catch (e2) {
        logger.error('❌ Gagal lock akun dari menu Akun Saya:', e2.message);
        await ctx.reply('❌ *Terjadi kesalahan saat mengunci akun.*', { parse_mode: 'Markdown' });
      }
    } catch (err) {
      logger.error('Kesalahan saat mengambil akun untuk lock:', err.message);
      return ctx.reply('❌ Terjadi kesalahan saat membaca data akun.');
    }
  });

  bot.action(/accunlock:(\d+)/, async (ctx) => {
    try {
      await ctx.answerCbQuery().catch(() => {});
    } catch (e) {}

    if (!ctx.from) return ctx.reply('❌ Tidak bisa membaca data pengguna.');

    const userId = ctx.from.id;
    const accountId = parseInt(ctx.match[1], 10);
    if (!accountId) return ctx.reply('❌ ID akun tidak valid.');

    try {
      const row = await getAccountById(db, accountId);

      if (!row || row.user_id !== userId) {
        return ctx.reply('❌ Akun ini tidak ditemukan atau bukan milik kamu.');
      }

      const unlockFunctions = {
        vmess: unlockvmess,
        vless: unlockvless,
        trojan: unlocktrojan,
        shadowsocks: unlockshadowsocks,
        ssh: unlockssh,
      };

      const fn = unlockFunctions[row.type];
      if (!fn) return ctx.reply('❌ Tipe akun tidak dikenal, tidak bisa dibuka kuncinya.');

      try {
        const msg = await fn(row.username, 'none', 'none', 'none', row.server_id);
        await recordAccountTransaction(userId, row.type);
        await ctx.reply(msg, { parse_mode: 'Markdown' });
        logger.info(`✅ Akun ${row.type} (${row.username}) di-unlock lewat Akun Saya oleh ${userId}`);
      } catch (e2) {
        logger.error('❌ Gagal unlock akun dari menu Akun Saya:', e2.message);
        await ctx.reply('❌ *Terjadi kesalahan saat membuka kunci akun.*', { parse_mode: 'Markdown' });
      }
    } catch (err) {
      logger.error('Kesalahan saat mengambil akun untuk unlock:', err.message);
      return ctx.reply('❌ Terjadi kesalahan saat membaca data akun.');
    }
  });

  bot.action(/accrenew:(\d+)/, async (ctx) => {
    try {
      await ctx.answerCbQuery().catch(() => {});
    } catch (e) {}

    if (!ctx.from) return ctx.reply('❌ Tidak bisa membaca data pengguna.');

    const userId = ctx.from.id;
    const chatId = ctx.chat.id;
    const accountId = parseInt(ctx.match[1], 10);
    if (!accountId) return ctx.reply('❌ ID akun tidak valid.');

    try {
      const row = await getAccountDetailWithServerById(db, accountId);

      if (!row || row.user_id !== userId) {
        return ctx.reply('❌ Akun ini tidak ditemukan atau bukan milik kamu.');
      }

      const serverName = row.nama_server || (row.server_id ? `Server ${row.server_id}` : 'Server ?');

      let status = '⏳ Tidak diketahui';
      if (row.expires_at) {
        const daysLeft = getAccountDaysLeft(row.expires_at);
        if (daysLeft > 0) status = `✅ Aktif (~${daysLeft} hari lagi)`;
        else if (daysLeft === 0) status = '⚠️ Aktif (habis HARI INI)';
        else status = '❌ Sudah expired';
      }

      userState[chatId] = {
        action: 'renew',
        type: row.type,
        username: row.username,
        serverId: row.server_id,
        password: 'none',
        step: `exp_renew_${row.type}`,
      };

      const infoText =
        '➡️ <b>PERPANJANG AKUN</b>\n\n' +
        `Tipe    : <b>${row.type}</b>\n` +
        `Username: <b>${row.username}</b>\n` +
        `Server  : ${serverName}\n` +
        `Status  : ${status}\n\n` +
        'Silakan kirim <b>masa aktif tambahan</b> dalam hari.\n' +
        'Contoh: <code>30</code>';

      await sendCleanMenu(ctx, infoText, { parse_mode: 'HTML' });
    } catch (err) {
      logger.error('Kesalahan saat mengambil data akun untuk perpanjang:', err.message);
      return ctx.reply('❌ Terjadi kesalahan saat membaca data akun.');
    }
  });
}

module.exports = { registerMyAccountDetailHandlers };
