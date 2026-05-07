async function handleTextAddSaldoFlow(ctx, deps) {
  const {
    state,
    text,
    db,
    logger,
    userState,
    recordSaldoTransaction,
    bot,
    GROUP_ID,
    NOTIF_TOPUP_GROUP,
  } = deps;

  if (state && state.step === 'addsaldo_userid') {
    state.targetId = text.trim();
    state.step = 'addsaldo_amount';
    await ctx.reply('💰 Masukkan jumlah saldo yang ingin ditambahkan:');
    return true;
  }

  if (state && state.step === 'addsaldo_amount') {
    const amount = parseInt(text.trim(), 10);
    if (isNaN(amount) || amount <= 0) {
      await ctx.reply('⚠️ Jumlah saldo harus berupa angka dan lebih dari 0.');
      return true;
    }

    const targetId = state.targetId;

    db.run('UPDATE users SET saldo = saldo + ? WHERE user_id = ?', [amount, targetId], (err) => {
      if (err) {
        logger.error('❌ Gagal menambah saldo:', err.message);
        ctx.reply('❌ Gagal menambah saldo ke user.');
        return;
      }

      db.get('SELECT saldo FROM users WHERE user_id = ?', [targetId], (err2, updated) => {
        const safeTargetId = Number(targetId);

        if (err2 || !updated) {
          recordSaldoTransaction(safeTargetId, amount, 'manual_addsaldo', `addsaldo_by_${ctx.from.id}`);

          bot.telegram
            .sendMessage(
              safeTargetId,
              '💰 Saldo kamu telah <b>ditambahkan</b> sebesar <b>Rp ' + amount.toLocaleString() + '</b>.\n' +
                '💳 Silakan cek saldo kamu di bot.',
              { parse_mode: 'HTML' }
            )
            .catch((e) => {
              logger.error(
                '❌ Gagal mengirim notif saldo masuk ke user (menu tambah_saldo, saldo tidak terbaca):',
                e.message
              );
            });

          ctx.reply(`✅ Saldo sebesar Rp${amount.toLocaleString()} berhasil ditambahkan ke user ${targetId}.`);
          logger.info(
            `Admin ${ctx.from.id} menambah saldo Rp${amount} ke user ${targetId} (gagal membaca saldo terbaru).`
          );
        } else {
          recordSaldoTransaction(safeTargetId, amount, 'manual_addsaldo', `addsaldo_by_${ctx.from.id}`);

          bot.telegram
            .sendMessage(
              safeTargetId,
              '💰 Saldo kamu telah <b>ditambahkan</b> sebesar <b>Rp ' + amount.toLocaleString() + '</b>.\n' +
                '💳 Saldo sekarang: <b>Rp ' + updated.saldo.toLocaleString() + '</b>.',
              { parse_mode: 'HTML' }
            )
            .catch((e) => {
              logger.error('❌ Gagal mengirim notif saldo masuk ke user (menu tambah_saldo):', e.message);
            });

          ctx.reply(
            `✅ Saldo sebesar Rp${amount.toLocaleString()} berhasil ditambahkan ke user ${targetId}.\n` +
              `💳 Saldo sekarang: Rp${updated.saldo.toLocaleString()}`
          );
          logger.info(
            `Admin ${ctx.from.id} menambah saldo Rp${amount} ke user ${targetId} (Saldo akhir: Rp${updated.saldo}).`
          );
        }

        try {
          if (NOTIF_TOPUP_GROUP && typeof GROUP_ID !== 'undefined' && GROUP_ID) {
            (async () => {
              try {
                const targetInfo = await bot.telegram.getChat(safeTargetId).catch(() => ({}));
                const targetName = targetInfo.username
                  ? '@' + targetInfo.username
                  : targetInfo.first_name || String(safeTargetId);

                const waktu = new Date().toLocaleString('id-ID', {
                  timeZone: 'Asia/Jayapura',
                  year: 'numeric',
                  month: '2-digit',
                  day: '2-digit',
                  hour: '2-digit',
                  minute: '2-digit',
                });

                const notifTopup =
                  '<blockquote>\n' +
                  '===== TOPUP MANUAL =====\n\n' +
                  '<code>\n' +
                  'User   : ' + targetName + ' (' + safeTargetId + ')\n' +
                  'Topup  : Rp ' + amount.toLocaleString() + '\n' +
                  'Status : SUCCESS\n' +
                  'Tanggal: ' + waktu + '\n' +
                  '</code>\n' +
                  '========================\n' +
                  '</blockquote>';

                await bot.telegram.sendMessage(GROUP_ID, notifTopup, { parse_mode: 'HTML' });
              } catch (e) {
                logger.error('❌ Gagal kirim notif topup manual ke grup:', e.message);
              }
            })();
          }
        } catch (e) {
          logger.error('❌ Error umum saat proses notif grup topup manual:', e.message);
        }
      });

      delete userState[ctx.from.id];
    });

    return true;
  }

  return false;
}

module.exports = { handleTextAddSaldoFlow };
