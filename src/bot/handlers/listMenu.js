function registerListMenuHandlers(bot, deps) {
  const { isAdmin, adminIds, logger, db, fs, resselFilePath, getUsernameById } = deps;

  const querySaldo = (userId) =>
    new Promise((resolve) => {
      db.get('SELECT saldo FROM users WHERE user_id = ?', [userId], (err, row) => {
        if (err || !row) return resolve(null);
        resolve(row);
      });
    });

  const loadResellerIds = () => {
    let resellerList = [];
    if (fs.existsSync(resselFilePath)) {
      const fileContent = fs.readFileSync(resselFilePath, 'utf8');
      resellerList = fileContent
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l !== '');
    }
    return resellerList;
  };

  bot.action('list_reseller', async (ctx) => {
    const adminId = ctx.from.id;
    if (!isAdmin(adminId, adminIds)) {
      return ctx.reply('🚫 Anda tidak memiliki izin untuk menggunakan menu ini.');
    }

    await ctx.answerCbQuery().catch(() => {});

    try {
      const resellerList = loadResellerIds();
      if (resellerList.length === 0) {
        return ctx.reply('ℹ️ Belum ada reseller terdaftar.');
      }

      const lines = [];
      let no = 1;

      for (const idStr of resellerList) {
        const userId = Number(idStr);
        if (!userId) continue;

        let username = '';
        try {
          username = await getUsernameById(userId);
        } catch (e) {
          username = '';
        }

        const displayName = username
          ? (username.startsWith('@') ? username : '@' + username)
          : `ID:${userId}`;

        const saldoRow = await querySaldo(userId);
        const saldoText = saldoRow ? `Rp${saldoRow.saldo}` : 'Rp0';

        lines.push(`${no}. ${displayName} (${userId}) — Saldo: ${saldoText}`);
        no++;
      }

      const message =
        '<b>📋 DAFTAR RESELLER</b>\n\n' +
        (lines.length ? lines.join('\n') : 'Belum ada reseller yang tercatat di database users.');

      await ctx.reply(message, { parse_mode: 'HTML' });
    } catch (err) {
      logger.error('❌ Error saat menampilkan daftar reseller:', err);
      await ctx.reply('❌ Terjadi kesalahan saat menampilkan daftar reseller.');
    }
  });

  bot.action('list_member', async (ctx) => {
    const adminId = ctx.from.id;

    if (!isAdmin(adminId, adminIds)) {
      return ctx.reply('🚫 Anda tidak memiliki izin untuk menggunakan menu ini.');
    }

    await ctx.answerCbQuery().catch(() => {});

    try {
      const allUsers = await new Promise((resolve, reject) => {
        db.all('SELECT user_id, saldo FROM users', [], (err, rows) => {
          if (err) return reject(err);
          resolve(rows || []);
        });
      });

      let resellerSet = new Set();
      try {
        const resellerList = loadResellerIds();
        resellerSet = new Set(resellerList);
      } catch (e) {
        logger.error('⚠️ Gagal membaca ressel.db saat list_member:', e);
      }

      const memberUsers = allUsers.filter((u) => {
        const uidStr = String(u.user_id);
        if (resellerSet.has(uidStr)) return false;
        if (isAdmin(Number(u.user_id), adminIds)) return false;
        return true;
      });

      if (memberUsers.length === 0) {
        return ctx.reply('ℹ️ Belum ada member biasa yang terdaftar.');
      }

      const lines = [];
      let no = 1;

      for (const user of memberUsers) {
        const userId = user.user_id;

        let username = '';
        try {
          username = await getUsernameById(userId);
        } catch (e) {
          username = '';
        }

        const displayName = username
          ? (username.startsWith('@') ? username : '@' + username)
          : `ID:${userId}`;

        const saldoText = Number(user.saldo || 0).toLocaleString('id-ID');
        lines.push(`${no}. ${displayName} (${userId}) — Saldo: Rp${saldoText}`);
        no++;
      }

      const message = '<b>📋 DAFTAR MEMBER</b>\n\n' + lines.join('\n');
      await ctx.reply(message, { parse_mode: 'HTML' });
    } catch (error) {
      logger.error('❌ Error saat menampilkan daftar member:', error);
      await ctx.reply('❌ Terjadi kesalahan saat menampilkan daftar member.');
    }
  });
}

module.exports = { registerListMenuHandlers };
