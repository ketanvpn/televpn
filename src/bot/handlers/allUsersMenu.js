function registerAllUsersMenuHandlers(bot, deps) {
  const { isAdmin, adminIds, logger, db, fs, resselFilePath, getUsernameById } = deps;

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

  async function renderAllUsersPage(ctx, page, editMessage) {
    try {
      const adminId = ctx.from?.id;
      if (!isAdmin(adminId, adminIds)) {
        if (!editMessage) {
          await ctx.reply('🚫 Anda tidak memiliki izin untuk menggunakan menu ini.');
        }
        return;
      }

      const allUsers = await new Promise((resolve, reject) => {
        db.all(
          'SELECT user_id, saldo, flag_status, flag_note FROM users ORDER BY user_id ASC',
          [],
          (err, rows) => {
            if (err) return reject(err);
            resolve(rows || []);
          }
        );
      });

      if (!allUsers.length) {
        const text = 'ℹ️ Belum ada user terdaftar di database.';
        if (editMessage) {
          try {
            await ctx.editMessageText(text, { parse_mode: 'HTML' });
          } catch (e) {
            await ctx.reply(text, { parse_mode: 'HTML' });
          }
        } else {
          await ctx.reply(text, { parse_mode: 'HTML' });
        }
        return;
      }

      const resellerSet = new Set(loadResellerIds());
      const pageSize = 40;
      const totalPages = Math.max(1, Math.ceil(allUsers.length / pageSize));
      const safePage = Math.min(Math.max(1, Number(page) || 1), totalPages);
      const start = (safePage - 1) * pageSize;
      const pageUsers = allUsers.slice(start, start + pageSize);

      const lines = [];
      let idx = start + 1;

      for (const user of pageUsers) {
        const userId = user.user_id;
        let username = '';
        try {
          username = await getUsernameById(userId);
        } catch (e) {
          username = '';
        }

        const displayName = username ? (username.startsWith('@') ? username : '@' + username) : `ID:${userId}`;
        const type = isAdmin(Number(userId), adminIds) ? 'ADMIN' : resellerSet.has(String(userId)) ? 'RESELLER' : 'MEMBER';
        const saldoText = Number(user.saldo || 0).toLocaleString('id-ID');
        const flagText = user.flag_status ? ` | Flag: ${user.flag_status}${user.flag_note ? ` (${user.flag_note})` : ''}` : '';

        lines.push(`${idx}. ${displayName} (${userId}) — ${type} — Saldo: Rp${saldoText}${flagText}`);
        idx++;
      }

      const header =
        '<b>📋 DAFTAR SEMUA USER</b>\n' +
        `Hal ${safePage}/${totalPages} (maks ${pageSize} user/halaman)\n\n`;
      const message = header + '<pre>' + lines.join('\n') + '</pre>';

      const buttons = [];
      if (safePage > 1) {
        buttons.push({ text: '⬅️ Sebelumnya', callback_data: `list_all_users_p_${safePage - 1}` });
      }
      if (safePage < totalPages) {
        buttons.push({ text: 'Berikutnya ➡️', callback_data: `list_all_users_p_${safePage + 1}` });
      }

      const opts = { parse_mode: 'HTML' };
      if (buttons.length) opts.reply_markup = { inline_keyboard: [buttons] };

      if (editMessage) {
        try {
          await ctx.editMessageText(message, opts);
        } catch (e) {
          await ctx.reply(message, opts);
        }
      } else {
        await ctx.reply(message, opts);
      }
    } catch (err) {
      logger.error('❌ Error di renderAllUsersPage:', err);
      if (!editMessage) {
        await ctx.reply('❌ Terjadi kesalahan saat menampilkan daftar semua user.', { parse_mode: 'HTML' });
      }
    }
  }

  bot.action('list_all_users', async (ctx) => {
    await ctx.answerCbQuery().catch(() => {});
    await renderAllUsersPage(ctx, 1, false);
  });

  bot.action(/list_all_users_p_(\d+)/, async (ctx) => {
    await ctx.answerCbQuery().catch(() => {});
    const page = parseInt(ctx.match[1], 10) || 1;
    await renderAllUsersPage(ctx, page, true);
  });
}

module.exports = { registerAllUsersMenuHandlers };
