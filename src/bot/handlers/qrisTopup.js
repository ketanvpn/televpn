function registerQrisTopupHandlers(bot, deps) {
  const {
    logger,
    userState,
    isAdmin,
    adminIds,
    NO_ACCESS_MESSAGE,
    openTopupQrisMenu,
    getProcessQrisTopupInvoice,
    sendCleanMenu,
    path,
    fs,
    axios,
    lastMenuMsgId,
    keyboardNomor,
    qrisPath,
    NAMA_STORE,
    ADMIN_USERNAME,
  } = deps;

  bot.command('topupqris', async (ctx) => {
    await openTopupQrisMenu(ctx);
  });

  bot.action('topupqris_btn', async (ctx) => {
    await ctx.answerCbQuery().catch(() => {});
    await openTopupQrisMenu(ctx);
  });

  bot.action('qris_topup_confirm_yes', async (ctx) => {
    await ctx.answerCbQuery().catch(() => {});

    const chatId = ctx.chat.id;
    const state = userState[chatId];

    if (!state || state.step !== 'qris_topup_confirm' || !state.baseAmount) {
      await ctx.reply('⚠️ Sesi topup sudah tidak aktif. Silakan mulai lagi dari menu topup.', {
        parse_mode: 'HTML',
      });
      return;
    }

    const baseAmount = Number(state.baseAmount);
    const forcedUniqueSuffix = state.previewUniqueSuffix ?? null;
    delete userState[chatId];

    try {
      await ctx.deleteMessage();
    } catch (_) {
      try {
        await ctx.editMessageReplyMarkup({ inline_keyboard: [] });
      } catch (_) {}
    }

    const processQrisTopupInvoice = getProcessQrisTopupInvoice();
    await processQrisTopupInvoice(ctx, baseAmount, forcedUniqueSuffix);
  });

  bot.action('qris_topup_confirm_cancel', async (ctx) => {
    await ctx.answerCbQuery('Topup dibatalkan').catch(() => {});

    const chatId = ctx.chat.id;
    delete userState[chatId];

    try {
      await ctx.editMessageText('✅ Topup dibatalkan.', {
        parse_mode: 'HTML',
      });
    } catch (_) {
      await ctx.reply('✅ Topup dibatalkan.', {
        parse_mode: 'HTML',
      });
    }
  });

  bot.action('qris_auto_topup', async (ctx) => {
    try {
      const userId = String(ctx.from.id);

      global.depositState = global.depositState || {};
      global.depositState[userId] = { amount: '' };

      const msg =
        `💰 *Silakan masukkan jumlah nominal saldo yang Anda ingin tambahkan ke akun Anda:*\n\n` +
        `Jumlah saat ini: *Rp 0*`;

      const opts = {
        reply_markup: { inline_keyboard: keyboardNomor() },
        parse_mode: 'Markdown',
      };

      try {
        await ctx.editMessageText(msg, opts);
      } catch {
        await ctx.reply(msg, opts);
      }

      await ctx.answerCbQuery('OK').catch(() => {});
    } catch (e) {
      try {
        await ctx.answerCbQuery('Gagal membuka topup', { show_alert: true });
      } catch {}
    }
  });

  bot.on('photo', async (ctx) => {
    const adminId = ctx.from.id;
    const state = userState[adminId];
    if (!state || state.step !== 'upload_qris') return;

    const fileId = ctx.message.photo.pop().file_id;
    const fileLink = await ctx.telegram.getFileLink(fileId);
    const response = await axios.get(fileLink.href, { responseType: 'arraybuffer' });
    fs.writeFileSync(qrisPath, Buffer.from(response.data));

    await ctx.reply('✅ Gambar QRIS berhasil diunggah!');
    logger.info('📷 QRIS image uploaded by admin');
    delete userState[adminId];
  });

  bot.action('upload_qris', async (ctx) => {
    const adminId = ctx.from.id;
    if (!isAdmin(adminId, adminIds)) {
      return ctx.reply(NO_ACCESS_MESSAGE, { parse_mode: 'HTML' });
    }

    await ctx.reply('📷 Kirim gambar QRIS yang ingin digunakan:');
    userState[adminId] = { step: 'upload_qris' };
  });

  bot.action('topup_manual', async (ctx) => {
    try {
      await ctx.answerCbQuery().catch(() => {});

      const storeName = NAMA_STORE || 'Layanan VPN';
      const adminName = ADMIN_USERNAME || 'Admin';
      const userId = ctx.from.id;

      const captionText = `
<b>💰 Top Up Saldo Manual via QRIS - ${storeName}</b>

1️⃣ Scan QRIS di atas dengan aplikasi pembayaran kamu.
2️⃣ Masukkan nominal sesuai saldo yang ingin kamu isi.
💸 Minimal top up: <b>Rp15.000</b>.
3️⃣ Setelah pembayaran <b>BERHASIL</b>, kirim bukti ke admin ${adminName}.

<b>📩 Format pesan ke admin:</b>
<code>Saya sudah top up saldo.
ID Telegram : ${userId}
Nominal     : Rp...
Metode      : QRIS</code>

Kalau belum pernah chat admin, klik username ${adminName} atau hubungi via WhatsApp:
https://wa.me/6282397803813

<i>Admin akan mengecek pembayaran kamu dan mengisi saldo secepatnya.</i>
`.trim();

      if (fs.existsSync(qrisPath)) {
        const userIdForTopup = ctx.from.id;
        const prevId = lastMenuMsgId.get(userIdForTopup);
        if (prevId) {
          try {
            await ctx.telegram.deleteMessage(ctx.chat.id, prevId);
          } catch (e) {}
        }

        const sent = await ctx.replyWithPhoto(
          { source: qrisPath },
          { caption: captionText, parse_mode: 'HTML' }
        );

        if (sent && sent.message_id) {
          lastMenuMsgId.set(userIdForTopup, sent.message_id);
        }
      } else {
        const msgText = `⚠️ QRIS belum diunggah oleh admin. Silakan hubungi ${adminName}.`;

        const userIdForTopup = ctx.from.id;
        const prevId = lastMenuMsgId.get(userIdForTopup);
        if (prevId) {
          try {
            await ctx.telegram.deleteMessage(ctx.chat.id, prevId);
          } catch (e) {}
        }

        const sent = await ctx.reply(msgText);
        if (sent && sent.message_id) {
          lastMenuMsgId.set(userIdForTopup, sent.message_id);
        }
      }
    } catch (err) {
      logger.error('❌ Error di topup_manual:', err.message);
      try {
        await sendCleanMenu(ctx, '❌ Terjadi kesalahan saat menampilkan QRIS.', {
          parse_mode: 'HTML',
        });
      } catch (e) {}
    }
  });
}

module.exports = { registerQrisTopupHandlers };
