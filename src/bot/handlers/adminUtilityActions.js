const {
  getTotalAccounts,
  getTotalActiveAccounts,
  getTotalExpiredAccounts,
  getTopResellerStatsSince,
} = require('../../repositories/accountRepository');

function registerAdminUtilityActions(bot, deps) {
  const {
    logger,
    db,
    fs,
    path,
    userState,
    isAdmin,
    adminIds,
    isMaster,
    MASTER_ID,
    resselFilePath,
    getUsernameById,
    sendAdminMenu,
    getExpiryReminderStatusText,
    buildExpiryReminderKeyboard,
    getTimezoneStatusText,
    buildTimezoneKeyboard,
    setTimezoneAndRefresh,
    adjustReminderTimeAndRefresh,
    setReminderDaysPreset,
    getAutoBackupStatusText,
    buildAutoBackupKeyboard,
    adjustIntervalAndRefresh,
    setIntervalPreset,
    toggleExpiryReminderAndRefresh,
    toggleAutoBackupAndRefresh,
  } = deps;

  bot.action('backup_db', async (ctx) => {
    try {
      const adminId = ctx.from.id;
      if (!isAdmin(adminId, adminIds)) {
        return ctx.reply('≡ƒÜ½ Kamu tidak memiliki izin untuk melakukan tindakan ini.');
      }

      const dbPath = path.join(__dirname, 'sellvpn.db');
      if (!fs.existsSync(dbPath)) {
        return ctx.reply('⚠️ File database tidak ditemukan.');
      }

      await ctx.replyWithDocument({ source: dbPath, filename: 'sellvpn.db' }, {
        caption: '✅ Backup database berhasil dikirim!',
      });

      logger.info(`✅ Backup database dikirim ke admin ${adminId}`);
    } catch (error) {
      logger.error('❌ Gagal mengirim file backup ke admin:', error);
      ctx.reply('❌ Terjadi kesalahan saat mengirim file backup.');
    }
  });

  bot.action('expiry_reminder_menu', async (ctx) => {
    const adminId = ctx.from.id;
    if (!isAdmin(adminId, adminIds)) {
      return ctx.answerCbQuery('Tidak ada izin.', { show_alert: true });
    }

    await ctx.answerCbQuery().catch(() => {});

    try {
      await ctx.editMessageText(getExpiryReminderStatusText(), {
        parse_mode: 'HTML',
        reply_markup: buildExpiryReminderKeyboard(),
      });
    } catch (e) {
      logger.error('❌ Gagal kirim menu pengingat expired:', e.message);
      await ctx.reply(getExpiryReminderStatusText(), {
        parse_mode: 'HTML',
        reply_markup: buildExpiryReminderKeyboard(),
      });
    }
  });

  bot.action('timezone_menu', async (ctx) => {
    const adminId = ctx.from.id;
    if (!isAdmin(adminId, adminIds)) {
      return ctx.answerCbQuery('Tidak ada izin.', { show_alert: true });
    }

    await ctx.answerCbQuery().catch(() => {});

    try {
      await ctx.reply(getTimezoneStatusText(), {
        parse_mode: 'HTML',
        reply_markup: buildTimezoneKeyboard(),
      });
    } catch (e) {
      logger.error('❌ Gagal kirim menu timezone:', e.message || e);
    }
  });

  bot.action('timezone_set_wib', (ctx) => setTimezoneAndRefresh(ctx, 'Asia/Jakarta', 'WIB (Asia/Jakarta)'));
  bot.action('timezone_set_wita', (ctx) => setTimezoneAndRefresh(ctx, 'Asia/Makassar', 'WITA (Asia/Makassar)'));
  bot.action('timezone_set_wit', (ctx) => setTimezoneAndRefresh(ctx, 'Asia/Jayapura', 'WIT (Asia/Jayapura)'));

  bot.action('expiry_reminder_toggle', async (ctx) => {
    const adminId = ctx.from.id;
    if (!isAdmin(adminId, adminIds)) {
      return ctx.answerCbQuery('Tidak ada izin.', { show_alert: true });
    }

    await toggleExpiryReminderAndRefresh(ctx);
  });

  bot.action('expiry_hour_minus', (ctx) => adjustReminderTimeAndRefresh(ctx, -1, 0));
  bot.action('expiry_hour_plus', (ctx) => adjustReminderTimeAndRefresh(ctx, +1, 0));
  bot.action('expiry_minute_minus', (ctx) => adjustReminderTimeAndRefresh(ctx, 0, -5));
  bot.action('expiry_minute_plus', (ctx) => adjustReminderTimeAndRefresh(ctx, 0, +5));
  bot.action('expiry_days_1', (ctx) => setReminderDaysPreset(ctx, 1));
  bot.action('expiry_days_2', (ctx) => setReminderDaysPreset(ctx, 2));
  bot.action('expiry_days_3', (ctx) => setReminderDaysPreset(ctx, 3));

  bot.action('backup_auto_menu', async (ctx) => {
    const adminId = ctx.from.id;
    if (!isMaster(adminId, MASTER_ID)) {
      return ctx.answerCbQuery('Tidak ada izin.', { show_alert: true });
    }

    await ctx.answerCbQuery().catch(() => {});
    try {
      await ctx.reply(getAutoBackupStatusText(), {
        parse_mode: 'HTML',
        reply_markup: buildAutoBackupKeyboard(),
      });
    } catch (e) {
      logger.error('❌ Gagal kirim menu auto backup:', e.message);
    }
  });

  bot.action('backup_auto_toggle', async (ctx) => {
    const adminId = ctx.from.id;
    if (!isMaster(adminId, MASTER_ID)) {
      return ctx.answerCbQuery('Tidak ada izin.', { show_alert: true });
    }

    await toggleAutoBackupAndRefresh(ctx);
  });

  bot.action('backup_auto_interval_minus', (ctx) => adjustIntervalAndRefresh(ctx, -1));
  bot.action('backup_auto_interval_plus', (ctx) => adjustIntervalAndRefresh(ctx, +1));
  bot.action('backup_auto_set_6', (ctx) => setIntervalPreset(ctx, 6));
  bot.action('backup_auto_set_12', (ctx) => setIntervalPreset(ctx, 12));
  bot.action('backup_auto_set_24', (ctx) => setIntervalPreset(ctx, 24));

  bot.action('cek_saldo_user', async (ctx) => {
    const adminId = ctx.from.id;
    if (!isAdmin(adminId, adminIds)) {
      return ctx.reply('≡ƒÜ½ Anda tidak memiliki izin untuk menggunakan fitur ini.');
    }

    await ctx.answerCbQuery();
    await ctx.reply('≡ƒöì Masukkan ID Telegram user yang ingin dicek saldonya:');
    userState[adminId] = { step: 'cek_saldo_userid' };
  });

  bot.action('riwayat_saldo_user', async (ctx) => {
    const adminId = ctx.from.id;
    if (!isAdmin(adminId, adminIds)) {
      return ctx.reply('≡ƒÜ½ Anda tidak memiliki izin untuk menggunakan fitur ini.');
    }

    await ctx.answerCbQuery().catch(() => {});
    await ctx.reply('≡ƒô£ Masukkan ID Telegram user/reseller yang ingin dilihat riwayat saldonya:');
    userState[adminId] = { step: 'riwayat_saldo_userid' };
  });

  bot.action('flag_user_start', async (ctx) => {
    const adminId = ctx.from.id;
    if (!isAdmin(adminId, adminIds)) {
      return ctx.reply('≡ƒÜ½ Anda tidak memiliki izin untuk menggunakan fitur ini.');
    }

    await ctx.answerCbQuery().catch(() => {});
    await ctx.reply(
      '≡ƒÜ⌐ *Mode tandai user*\n\n' +
        'Silakan kirim *ID Telegram user* yang ingin diatur statusnya.\n' +
        'Ketik *batal* untuk keluar dari mode ini.',
      { parse_mode: 'Markdown' }
    );
    userState[adminId] = { step: 'flag_user_wait_id' };
  });

  bot.action(/flag_user_set_(NORMAL|WATCHLIST|NAKAL)_(\d+)/, async (ctx) => {
    const adminId = ctx.from.id;
    if (!isAdmin(adminId, adminIds)) {
      return ctx.reply('≡ƒÜ½ Anda tidak memiliki izin untuk menggunakan fitur ini.');
    }

    await ctx.answerCbQuery().catch(() => {});
    const newStatus = ctx.match[1];
    const targetId = ctx.match[2];

    db.run('UPDATE users SET flag_status = ? WHERE user_id = ?', [newStatus, targetId], function (err) {
      if (err) {
        logger.error('❌ Gagal mengupdate flag_status user:', err.message);
        return ctx.reply('❌ Terjadi kesalahan saat mengupdate status user.');
      }

      if (this.changes === 0) {
        return ctx.reply(`⚠️ User dengan ID ${targetId} tidak ditemukan di tabel users.`);
      }

      let label = '✅ NORMAL';
      if (newStatus === 'WATCHLIST') label = '⚠️ WATCHLIST';
      else if (newStatus === 'NAKAL') label = '⛔ NAKAL';

      ctx.reply(`✅ Status user \`${targetId}\` berhasil diubah menjadi: ${label}`, { parse_mode: 'Markdown' });
    });

    if (userState[adminId] && String(userState[adminId].step || '').startsWith('flag_user')) {
      delete userState[adminId];
    }
  });

  bot.action('monitor_panel', async (ctx) => {
    const adminId = ctx.from.id;
    if (!isAdmin(adminId, adminIds)) {
      return ctx.reply('≡ƒÜ½ Anda tidak memiliki izin untuk menggunakan menu ini.');
    }

    await ctx.answerCbQuery().catch(() => {});

    try {
      const nowTs = Date.now();
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

      const totalUsers = await new Promise((resolve) => {
        db.get('SELECT COUNT(*) AS count FROM users', [], (err, row) => {
          if (err) return resolve(0);
          resolve(row ? row.count : 0);
        });
      });

      const [totalAccounts, totalActiveAccounts, totalExpiredAccounts] = await Promise.all([
        getTotalAccounts(db).catch(() => 0),
        getTotalActiveAccounts(db, nowTs).catch(() => 0),
        getTotalExpiredAccounts(db, nowTs).catch(() => 0),
      ]);

      let resellerSet = new Set();
      let totalReseller = 0;
      try {
        if (fs.existsSync(resselFilePath)) {
          const fileContent = fs.readFileSync(resselFilePath, 'utf8');
          const resellerList = fileContent.split('\n').map((l) => l.trim()).filter((l) => l !== '');
          resellerSet = new Set(resellerList);
          totalReseller = resellerSet.size;
        }
      } catch (e) {
        logger.error('Gagal membaca ressel.db saat monitor_panel:', e.message);
      }

      const topResellerRows = await getTopResellerStatsSince(db, monthStart).catch(() => []);

      const topResellers = [];
      for (const row of topResellerRows) {
        const uidStr = String(row.user_id);
        if (!resellerSet.has(uidStr)) continue;
        if (row.total_month > 0) topResellers.push(row);
        if (topResellers.length >= 5) break;
      }

      const lines = [];
      lines.push('<b>≡ƒôè Monitor User & Reseller</b>\n');
      lines.push('<code>Ringkasan Pengguna</code>');
      lines.push(`• Total user terdaftar : <b>${totalUsers}</b>`);
      lines.push(`• Total reseller       : <b>${totalReseller}</b>\n`);
      lines.push('<code>Ringkasan Akun</code>');
      lines.push(`• Total akun dibuat    : <b>${totalAccounts}</b>`);
      lines.push(`• Akun aktif sekarang  : <b>${totalActiveAccounts}</b>`);
      lines.push(`• Akun sudah expired   : <b>${totalExpiredAccounts}</b>\n`);
      lines.push('<code>Top 5 Reseller (berdasarkan akun bulan ini)</code>');

      if (topResellers.length === 0) {
        lines.push('Belum ada reseller yang membuat akun di bulan ini.');
      } else {
        let no = 1;
        for (const r of topResellers) {
          let username = '';
          try { username = await getUsernameById(r.user_id); } catch (e) { username = ''; }
          const displayName = username ? (username.startsWith('@') ? username : '@' + username) : `ID:${r.user_id}`;
          lines.push(`${no}. ${displayName} — bulan ini: <b>${r.total_month || 0}</b> akun | total: <b>${r.total_all || 0}</b> akun`);
          no++;
        }
      }

      await ctx.reply(lines.join('\n'), {
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: [[{ text: '≡ƒöÖ Kembali ke Menu Admin', callback_data: 'admin_menu' }]] },
      });
    } catch (err) {
      logger.error('❌ Error di monitor_panel:', err);
      await ctx.reply('❌ Terjadi kesalahan saat menampilkan monitor user & reseller.');
    }
  });

  bot.action('list_res_mem', async (ctx) => {
    const adminId = ctx.from.id;
    if (!isAdmin(adminId, adminIds)) {
      return ctx.reply('≡ƒÜ½ Anda tidak memiliki izin untuk menggunakan menu ini.');
    }

    await ctx.answerCbQuery().catch(() => {});
    await ctx.reply('Pilih daftar yang ingin ditampilkan:', {
      reply_markup: {
        inline_keyboard: [
          [
            { text: '≡ƒôï List Reseller', callback_data: 'list_reseller' },
            { text: '≡ƒôï List Member', callback_data: 'list_member' },
          ],
          [{ text: '≡ƒöÖ Kembali ke Menu Admin', callback_data: 'admin_menu' }],
        ],
      },
    });
  });

  bot.action('admin_menu', async (ctx) => {
    await ctx.answerCbQuery().catch(() => {});
    await sendAdminMenu(ctx);
  });
}

module.exports = { registerAdminUtilityActions };
