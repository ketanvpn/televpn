function registerServerAdminHandlers(bot, deps) {
  const { isAdmin, adminIds, logger, db, userState } = deps;

  const answerNoAccess = (ctx, text = '❌ *Menu ini khusus admin.*') =>
    ctx.reply(text, { parse_mode: 'Markdown' });

  const isAllowed = (ctx) => isAdmin(ctx.from?.id, adminIds);

  const queryAllServers = () =>
    new Promise((resolve, reject) => {
      db.all('SELECT * FROM Server', [], (err, rows) => {
        if (err) return reject(err);
        resolve(rows || []);
      });
    });

  const queryServerById = (serverId) =>
    new Promise((resolve, reject) => {
      db.get('SELECT * FROM Server WHERE id = ?', [serverId], (err, row) => {
        if (err) return reject(err);
        resolve(row || null);
      });
    });

  const queryServerMetaById = (serverId) =>
    new Promise((resolve, reject) => {
      db.get('SELECT auth, domain, nama_server FROM Server WHERE id = ?', [serverId], (err, row) => {
        if (err) return reject(err);
        resolve(row || null);
      });
    });

  const removeAllServers = () =>
    new Promise((resolve, reject) => {
      db.run('DELETE FROM Server', (err) => {
        if (err) return reject(err);
        resolve();
      });
    });

  const removeServerById = (serverId) =>
    new Promise((resolve, reject) => {
      db.run('DELETE FROM Server WHERE id = ?', [serverId], function (err) {
        if (err) return reject(err);
        resolve(this.changes || 0);
      });
    });

  const buildServerMenuKeyboard = () => [
    [
      { text: '➕ Tambah Server', callback_data: 'addserver' },
      { text: '❌ Hapus Server', callback_data: 'deleteserver' },
    ],
    [
      { text: '💲 Edit Harga', callback_data: 'editserver_harga' },
      { text: '📝 Edit Nama', callback_data: 'nama_server_edit' },
    ],
    [
      { text: '🌐 Edit Domain', callback_data: 'editserver_domain' },
      { text: '🔑 Edit Auth', callback_data: 'editserver_auth' },
    ],
    [
      { text: '📊 Edit Quota', callback_data: 'editserver_quota' },
      { text: '📶 Edit Limit IP', callback_data: 'editserver_limit_ip' },
    ],
    [
      { text: '🔢 Edit Batas Create', callback_data: 'editserver_batas_create_akun' },
      { text: '🔢 Edit Total Create', callback_data: 'editserver_total_create_akun' },
    ],
    [
      { text: '📋 List Server', callback_data: 'listserver' },
      { text: '♻️ Reset Server', callback_data: 'resetdb' },
    ],
    [{ text: 'ℹ️ Detail Server', callback_data: 'detailserver' }],
    [{ text: '🔙 Kembali ke Menu Admin', callback_data: 'admin_menu' }],
  ];

  const showServerMenu = async (ctx, edit = true) => {
    const text =
      '<b>🌐 MANAGEMEN SERVER</b>\n\n' +
      'Pilih pengaturan yang berhubungan dengan server:\n\n' +
      '• Tambah / Hapus server\n' +
      '• Edit harga, nama, domain, auth\n' +
      '• Edit quota, limit IP, batas & total create\n' +
      '• Lihat list & detail server\n';

    const keyboard = buildServerMenuKeyboard();

    if (edit) {
      try {
        await ctx.editMessageText(text, {
          parse_mode: 'HTML',
          reply_markup: { inline_keyboard: keyboard },
        });
        return;
      } catch (err) {
        logger.error('Error saat buka submenu server:', err);
      }
    }

    await ctx.reply(text, {
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: keyboard },
    });
  };

  const promptServerSelection = async (ctx, title, callbackPrefix, emptyText) => {
    const servers = await queryAllServers();

    if (servers.length === 0) {
      return ctx.reply(emptyText, { parse_mode: 'Markdown' });
    }

    const buttons = servers.map((server) => ({
      text: server.nama_server,
      callback_data: `${callbackPrefix}_${server.id}`,
    }));

    const inlineKeyboard = [];
    for (let i = 0; i < buttons.length; i += 2) {
      inlineKeyboard.push(buttons.slice(i, i + 2));
    }

    await ctx.reply(title, {
      reply_markup: { inline_keyboard: inlineKeyboard },
      parse_mode: 'Markdown',
    });
  };

  bot.action('admin_server_menu', async (ctx) => {
    if (!isAllowed(ctx)) {
      return ctx.answerCbQuery('🚫 Khusus admin.', { show_alert: true }).catch(() => {});
    }

    await ctx.answerCbQuery().catch(() => {});
    await showServerMenu(ctx, true);
  });

  bot.action('addserver', async (ctx) => {
    try {
      if (!isAllowed(ctx)) return answerNoAccess(ctx);
      logger.info('📥 Proses tambah server dimulai');
      await ctx.answerCbQuery();
      await ctx.reply(
        '🌐 *Silakan masukkan domain/ip server.*\n' +
          'Ketik `batal` untuk membatalkan.',
        { parse_mode: 'Markdown' }
      );
      userState[ctx.chat.id] = { step: 'addserver' };
    } catch (error) {
      logger.error('❌ Kesalahan saat memulai proses tambah server:', error);
      await ctx.reply('❌ *GAGAL! Terjadi kesalahan saat memproses permintaan Anda. Silakan coba lagi nanti.*', { parse_mode: 'Markdown' });
    }
  });

  bot.action('detailserver', async (ctx) => {
    try {
      if (!isAllowed(ctx)) return answerNoAccess(ctx);
      logger.info('📋 Proses detail server dimulai');
      await ctx.answerCbQuery();

      const servers = await queryAllServers();
      if (servers.length === 0) {
        logger.info('⚠️ Tidak ada server yang tersedia');
        return ctx.reply('⚠️ *PERHATIAN! Tidak ada server yang tersedia saat ini.*', { parse_mode: 'Markdown' });
      }

      const buttons = [];
      for (let i = 0; i < servers.length; i += 2) {
        const row = [{ text: servers[i].nama_server, callback_data: `server_detail_${servers[i].id}` }];
        if (i + 1 < servers.length) {
          row.push({ text: servers[i + 1].nama_server, callback_data: `server_detail_${servers[i + 1].id}` });
        }
        buttons.push(row);
      }

      await ctx.reply('📋 *Silakan pilih server untuk melihat detail:*', {
        reply_markup: { inline_keyboard: buttons },
        parse_mode: 'Markdown',
      });
    } catch (error) {
      logger.error('⚠️ Kesalahan saat mengambil detail server:', error);
      await ctx.reply('⚠️ *Terjadi kesalahan saat mengambil detail server.*', { parse_mode: 'Markdown' });
    }
  });

  bot.action('listserver', async (ctx) => {
    try {
      if (!isAllowed(ctx)) return answerNoAccess(ctx);
      logger.info('📜 Proses daftar server dimulai');
      await ctx.answerCbQuery();

      const servers = await queryAllServers();
      if (servers.length === 0) {
        logger.info('⚠️ Tidak ada server yang tersedia');
        return ctx.reply('⚠️ *PERHATIAN! Tidak ada server yang tersedia saat ini.*', { parse_mode: 'Markdown' });
      }

      let serverList = '📜 *Daftar Server* 📜\n\n';
      servers.forEach((server, index) => {
        serverList += `🔹 ${index + 1}. ${server.domain}\n`;
      });
      serverList += `\nTotal Jumlah Server: ${servers.length}`;

      await ctx.reply(serverList, { parse_mode: 'Markdown' });
    } catch (error) {
      logger.error('⚠️ Kesalahan saat mengambil daftar server:', error);
      await ctx.reply('⚠️ *Terjadi kesalahan saat mengambil daftar server.*', { parse_mode: 'Markdown' });
    }
  });

  bot.action('resetdb', async (ctx) => {
    try {
      if (!isAllowed(ctx)) return answerNoAccess(ctx);
      await ctx.answerCbQuery();
      await ctx.reply('🚨 *PERHATIAN! Anda akan menghapus semua server yang tersedia. Apakah Anda yakin?*', {
        reply_markup: {
          inline_keyboard: [
            [{ text: '✅ Ya', callback_data: 'confirm_resetdb' }],
            [{ text: '❌ Tidak', callback_data: 'cancel_resetdb' }],
          ],
        },
        parse_mode: 'Markdown',
      });
    } catch (error) {
      logger.error('❌ Error saat memulai proses reset database:', error);
      await ctx.reply(`❌ *${error}*`, { parse_mode: 'Markdown' });
    }
  });

  bot.action('confirm_resetdb', async (ctx) => {
    try {
      if (!isAllowed(ctx)) return answerNoAccess(ctx);
      await ctx.answerCbQuery();
      await removeAllServers();
      await ctx.reply('🚨 *PERHATIAN! Database telah DIRESET SEPENUHNYA. Semua server telah DIHAPUS TOTAL.*', { parse_mode: 'Markdown' });
    } catch (error) {
      logger.error('❌ Error saat mereset database:', error);
      await ctx.reply(`❌ *${error}*`, { parse_mode: 'Markdown' });
    }
  });

  bot.action('cancel_resetdb', async (ctx) => {
    try {
      if (!isAllowed(ctx)) return answerNoAccess(ctx);
      await ctx.answerCbQuery();
      await ctx.reply('❌ *Proses reset database dibatalkan.*', { parse_mode: 'Markdown' });
    } catch (error) {
      logger.error('❌ Error saat membatalkan reset database:', error);
      await ctx.reply(`❌ *${error}*`, { parse_mode: 'Markdown' });
    }
  });

  bot.action('deleteserver', async (ctx) => {
    try {
      if (!isAllowed(ctx)) return answerNoAccess(ctx);
      logger.info('🗑️ Proses hapus server dimulai');
      await ctx.answerCbQuery();

      const servers = await queryAllServers();
      if (servers.length === 0) {
        logger.info('⚠️ Tidak ada server yang tersedia');
        return ctx.reply('⚠️ *PERHATIAN! Tidak ada server yang tersedia saat ini.*', { parse_mode: 'Markdown' });
      }

      const keyboard = servers.map((server) => [{ text: server.nama_server, callback_data: `confirm_delete_server_${server.id}` }]);
      keyboard.push([{ text: '🔙 Kembali ke Menu Utama', callback_data: 'kembali_ke_menu' }]);

      await ctx.reply('🗑️ *Pilih server yang ingin dihapus:*', {
        reply_markup: { inline_keyboard: keyboard },
        parse_mode: 'Markdown',
      });
    } catch (error) {
      logger.error('❌ Kesalahan saat memulai proses hapus server:', error);
      await ctx.reply('❌ *GAGAL! Terjadi kesalahan saat memproses permintaan Anda. Silakan coba lagi nanti.*', { parse_mode: 'Markdown' });
    }
  });

  bot.action('editserver_limit_ip', async (ctx) => {
    try {
      if (!isAllowed(ctx)) return answerNoAccess(ctx);
      logger.info('Edit server limit IP process started');
      await ctx.answerCbQuery();
      await promptServerSelection(
        ctx,
        '📊 *Silakan pilih server untuk mengedit limit IP:*',
        'edit_limit_ip',
        '⚠️ *PERHATIAN! Tidak ada server yang tersedia untuk diedit.*'
      );
    } catch (error) {
      logger.error('❌ Kesalahan saat memulai proses edit limit IP server:', error);
      await ctx.reply(`❌ *${error}*`, { parse_mode: 'Markdown' });
    }
  });

  bot.action('editserver_batas_create_akun', async (ctx) => {
    try {
      if (!isAllowed(ctx)) return answerNoAccess(ctx);
      logger.info('Edit server batas create akun process started');
      await ctx.answerCbQuery();
      await promptServerSelection(
        ctx,
        '📊 *Silakan pilih server untuk mengedit batas create akun:*',
        'edit_batas_create_akun',
        '⚠️ *PERHATIAN! Tidak ada server yang tersedia untuk diedit.*'
      );
    } catch (error) {
      logger.error('❌ Kesalahan saat memulai proses edit batas create akun server:', error);
      await ctx.reply(`❌ *${error}*`, { parse_mode: 'Markdown' });
    }
  });

  bot.action('editserver_total_create_akun', async (ctx) => {
    try {
      if (!isAllowed(ctx)) return answerNoAccess(ctx);
      logger.info('Edit server total create akun process started');
      await ctx.answerCbQuery();
      await promptServerSelection(
        ctx,
        '📊 *Silakan pilih server untuk mengedit total create akun:*',
        'edit_total_create_akun',
        '⚠️ *PERHATIAN! Tidak ada server yang tersedia untuk diedit.*'
      );
    } catch (error) {
      logger.error('❌ Kesalahan saat memulai proses edit total create akun server:', error);
      await ctx.reply(`❌ *${error}*`, { parse_mode: 'Markdown' });
    }
  });

  bot.action('editserver_quota', async (ctx) => {
    try {
      if (!isAllowed(ctx)) return answerNoAccess(ctx);
      logger.info('Edit server quota process started');
      await ctx.answerCbQuery();
      await promptServerSelection(
        ctx,
        '📊 *Silakan pilih server untuk mengedit quota:*',
        'edit_quota',
        '⚠️ *PERHATIAN! Tidak ada server yang tersedia untuk diedit.*'
      );
    } catch (error) {
      logger.error('❌ Kesalahan saat memulai proses edit quota server:', error);
      await ctx.reply(`❌ *${error}*`, { parse_mode: 'Markdown' });
    }
  });

  bot.action('editserver_auth', async (ctx) => {
    try {
      if (!isAllowed(ctx)) return answerNoAccess(ctx);
      logger.info('Edit server auth process started');
      await ctx.answerCbQuery();
      await promptServerSelection(
        ctx,
        '🌐 *Silakan pilih server untuk mengedit auth:*',
        'edit_auth',
        '⚠️ *PERHATIAN! Tidak ada server yang tersedia untuk diedit.*'
      );
    } catch (error) {
      logger.error('❌ Kesalahan saat memulai proses edit auth server:', error);
      await ctx.reply(`❌ *${error}*`, { parse_mode: 'Markdown' });
    }
  });

  bot.action('editserver_harga', async (ctx) => {
    try {
      if (!isAllowed(ctx)) return answerNoAccess(ctx);
      logger.info('Edit server harga process started');
      await ctx.answerCbQuery();
      await promptServerSelection(
        ctx,
        '💰 *Silakan pilih server untuk mengedit harga:*',
        'edit_harga',
        '⚠️ *PERHATIAN! Tidak ada server yang tersedia untuk diedit.*'
      );
    } catch (error) {
      logger.error('❌ Kesalahan saat memulai proses edit harga server:', error);
      await ctx.reply(`❌ *${error}*`, { parse_mode: 'Markdown' });
    }
  });

  bot.action('editserver_domain', async (ctx) => {
    try {
      if (!isAllowed(ctx)) return answerNoAccess(ctx);
      logger.info('Edit server domain process started');
      await ctx.answerCbQuery();
      await promptServerSelection(
        ctx,
        '🌐 *Silakan pilih server untuk mengedit domain:*',
        'edit_domain',
        '⚠️ *PERHATIAN! Tidak ada server yang tersedia untuk diedit.*'
      );
    } catch (error) {
      logger.error('❌ Kesalahan saat memulai proses edit domain server:', error);
      await ctx.reply(`❌ *${error}*`, { parse_mode: 'Markdown' });
    }
  });

  bot.action('nama_server_edit', async (ctx) => {
    try {
      if (!isAllowed(ctx)) return answerNoAccess(ctx);
      logger.info('Edit server nama process started');
      await ctx.answerCbQuery();
      await promptServerSelection(
        ctx,
        '🏷️ *Silakan pilih server untuk mengedit nama:*',
        'edit_nama',
        '⚠️ *PERHATIAN! Tidak ada server yang tersedia untuk diedit.*'
      );
    } catch (error) {
      logger.error('❌ Kesalahan saat memulai proses edit nama server:', error);
      await ctx.reply(`❌ *${error}*`, { parse_mode: 'Markdown' });
    }
  });

  bot.action(/confirm_delete_server_(\d+)/, async (ctx) => {
    try {
      if (!isAllowed(ctx)) return answerNoAccess(ctx);
      const changes = await removeServerById(ctx.match[1]);
      if (changes === 0) {
        logger.info('Server tidak ditemukan');
        return ctx.reply('⚠️ *PERHATIAN! Server tidak ditemukan.*', { parse_mode: 'Markdown' });
      }

      logger.info(`Server dengan ID ${ctx.match[1]} berhasil dihapus`);
      await ctx.reply('✅ *Server berhasil dihapus.*', { parse_mode: 'Markdown' });
    } catch (error) {
      logger.error('Kesalahan saat menghapus server:', error);
      await ctx.reply('❌ *GAGAL! Terjadi kesalahan saat memproses permintaan Anda. Silakan coba lagi nanti.*', { parse_mode: 'Markdown' });
    }
  });

  bot.action(/server_detail_(\d+)/, async (ctx) => {
    try {
      if (!isAllowed(ctx)) return answerNoAccess(ctx);
      const server = await queryServerById(ctx.match[1]);
      if (!server) {
        logger.info('⚠️ Server tidak ditemukan');
        return ctx.reply('⚠️ *PERHATIAN! Server tidak ditemukan.*', { parse_mode: 'Markdown' });
      }

      const serverDetails =
        `📋 *Detail Server* 📋\n\n` +
        `🌐 *Domain:* \`${server.domain}\`\n` +
        `🔑 *Auth:* \`${server.auth}\`\n` +
        `🏷️ *Nama Server:* \`${server.nama_server}\`\n` +
        `📊 *Quota:* \`${server.quota}\`\n` +
        `📶 *Limit IP:* \`${server.iplimit}\`\n` +
        `🔢 *Batas Create Akun:* \`${server.batas_create_akun}\`\n` +
        `📋 *Total Create Akun:* \`${server.total_create_akun}\`\n` +
        `💵 *Harga 30 hari:* \`Rp ${server.harga}\`\n\n`;

      await ctx.reply(serverDetails, { parse_mode: 'Markdown' });
    } catch (error) {
      logger.error('⚠️ Kesalahan saat mengambil detail server:', error);
      await ctx.reply('⚠️ *Terjadi kesalahan saat mengambil detail server.*', { parse_mode: 'Markdown' });
    }
  });

  bot.action(/edit_harga_(\d+)/, async (ctx) => {
    if (!isAllowed(ctx)) return answerNoAccess(ctx);
    const serverId = ctx.match[1];
    logger.info(`User ${ctx.from.id} memilih untuk mengedit harga server dengan ID: ${serverId}`);
    userState[ctx.chat.id] = { step: 'edit_harga', serverId };

    await ctx.reply('💰 *Silakan masukkan harga server baru:*', {
      parse_mode: 'Markdown',
    });
  });

  bot.action(/edit_batas_create_akun_(\d+)/, async (ctx) => {
    if (!isAllowed(ctx)) return answerNoAccess(ctx);
    const serverId = ctx.match[1];
    logger.info(`User ${ctx.from.id} memilih untuk mengedit batas create akun server dengan ID: ${serverId}`);
    userState[ctx.chat.id] = { step: 'edit_batas_create_akun', serverId };

    await ctx.reply('📊 *Silakan masukkan batas create akun server baru:*', {
      parse_mode: 'Markdown',
    });
  });

  bot.action(/edit_total_create_akun_(\d+)/, async (ctx) => {
    if (!isAllowed(ctx)) return answerNoAccess(ctx);
    const serverId = ctx.match[1];
    logger.info(`User ${ctx.from.id} memilih untuk mengedit total create akun server dengan ID: ${serverId}`);
    userState[ctx.chat.id] = { step: 'edit_total_create_akun', serverId };

    await ctx.reply('📊 *Silakan masukkan total create akun server baru:*', {
      parse_mode: 'Markdown',
    });
  });

  bot.action(/edit_limit_ip_(\d+)/, async (ctx) => {
    if (!isAllowed(ctx)) return answerNoAccess(ctx);
    const serverId = ctx.match[1];
    logger.info(`User ${ctx.from.id} memilih untuk mengedit limit IP server dengan ID: ${serverId}`);
    userState[ctx.chat.id] = { step: 'edit_limit_ip', serverId };

    await ctx.reply('📊 *Silakan masukkan limit IP server baru:*', {
      parse_mode: 'Markdown',
    });
  });

  bot.action(/edit_quota_(\d+)/, async (ctx) => {
    if (!isAllowed(ctx)) return answerNoAccess(ctx);
    const serverId = ctx.match[1];
    logger.info(`User ${ctx.from.id} memilih untuk mengedit quota server dengan ID: ${serverId}`);
    userState[ctx.chat.id] = { step: 'edit_quota', serverId };

    await ctx.reply('📊 *Silakan masukkan quota server baru:*', {
      parse_mode: 'Markdown',
    });
  });

  bot.action(/edit_auth_(\d+)/, async (ctx) => {
    try {
      if (!isAllowed(ctx)) return answerNoAccess(ctx);
      await ctx.answerCbQuery().catch(() => {});
      const serverId = ctx.match[1];
      logger.info(`User ${ctx.from.id} memilih untuk mengedit auth server dengan ID: ${serverId}`);

      const row = await queryServerMetaById(serverId);
      if (!row) {
        await ctx.reply('⚠️ Server tidak ditemukan.');
        return;
      }

      const currentAuth = row.auth || '-';
      const currentDomain = row.domain || '-';
      const currentNama = row.nama_server || '-';

      let maskedAuth = currentAuth;
      if (currentAuth.length > 8) maskedAuth = currentAuth.slice(0, 4) + '...' + currentAuth.slice(-4);

      userState[ctx.chat.id] = {
        step: 'edit_auth',
        serverId,
        oldAuth: currentAuth,
        domain: currentDomain,
        nama: currentNama,
      };

      await ctx.reply(
        '🔐 *Edit AUTH Server*\n' +
          `• Nama   : \`${currentNama}\`\n` +
          `• Domain : \`${currentDomain}\`\n` +
          `• Auth   : \`${maskedAuth}\`\n\n` +
          '🌐 *Silakan ketik AUTH server baru, lalu kirim sebagai pesan biasa.*\n' +
          '❌ Ketik *batal* untuk membatalkan.',
        { parse_mode: 'Markdown' }
      );
    } catch (error) {
      logger.error('Kesalahan saat memulai edit auth server:', error);
      await ctx.reply('⚠️ Terjadi kesalahan saat mengambil data server.');
    }
  });

  bot.action(/edit_domain_(\d+)/, async (ctx) => {
    try {
      if (!isAllowed(ctx)) return answerNoAccess(ctx);
      await ctx.answerCbQuery().catch(() => {});
      const serverId = ctx.match[1];
      logger.info(`User ${ctx.from.id} memilih untuk mengedit domain server dengan ID: ${serverId}`);

      const row = await queryServerById(serverId);
      if (!row) {
        await ctx.reply('⚠️ Server tidak ditemukan.');
        return;
      }

      const currentDomain = row.domain || '-';

      userState[ctx.chat.id] = {
        step: 'edit_domain',
        serverId,
        oldDomain: currentDomain,
      };

      await ctx.reply(
        '🌐 *Silakan ketik domain server baru, lalu kirim sebagai pesan biasa.*\n' +
          `📌 Domain saat ini: \`${currentDomain}\`\n` +
          '✏️ Contoh: `sg1.serverku.com`\n' +
          '❌ Ketik *batal* untuk membatalkan.',
        { parse_mode: 'Markdown' }
      );
    } catch (error) {
      logger.error('Kesalahan saat memulai edit domain server:', error);
      await ctx.reply('⚠️ Terjadi kesalahan saat mengambil data server.');
    }
  });

  bot.action(/edit_nama_(\d+)/, async (ctx) => {
    try {
      if (!isAllowed(ctx)) return answerNoAccess(ctx);
      const serverId = ctx.match[1];
      logger.info(`User ${ctx.from.id} memilih untuk mengedit nama server dengan ID: ${serverId}`);

      const row = await queryServerById(serverId);
      if (!row) {
        await ctx.reply('⚠️ Server tidak ditemukan.');
        return;
      }

      const currentName = row.nama_server || '-';
      userState[ctx.chat.id] = { step: 'edit_nama', serverId };

      await ctx.reply(
        '🏷️ *Silakan ketik nama server baru, lalu kirim sebagai pesan biasa.*\n' +
          `✏️ Contoh: \`${currentName}\`\n` +
          '❌ Ketik *batal* untuk membatalkan.',
        { parse_mode: 'Markdown' }
      );
    } catch (error) {
      logger.error('Kesalahan saat memulai edit nama server:', error);
      await ctx.reply('⚠️ Terjadi kesalahan saat mengambil data server.');
    }
  });
}

module.exports = { registerServerAdminHandlers };
