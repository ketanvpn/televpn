function registerServiceActionHandlers(bot, deps) {
  const { handleServiceAction, isAdmin, adminIds, isUserReseller, logger, TIME_ZONE } = deps;
  const { exec } = require('child_process');

  const showActionError = async (ctx) => {
    try {
      await ctx.answerCbQuery('❌ Terjadi kesalahan, silakan coba lagi.', { show_alert: true });
    } catch (e) {}
  };

  bot.action('service_trial', async (ctx) => {
    if (!ctx || !ctx.match) return showActionError(ctx);
    await handleServiceAction(ctx, 'trial');
  });

  bot.action('service_create', async (ctx) => {
    if (!ctx || !ctx.match) return showActionError(ctx);
    await handleServiceAction(ctx, 'create');
  });

  bot.action('service_renew', async (ctx) => {
    if (!ctx || !ctx.match) return showActionError(ctx);
    await handleServiceAction(ctx, 'renew');
  });

  bot.action('service_del', async (ctx) => {
    if (!ctx || !ctx.match) return showActionError(ctx);
    await handleServiceAction(ctx, 'del');
  });

  bot.action('service_lock', async (ctx) => {
    if (!ctx || !ctx.match) return showActionError(ctx);
    await handleServiceAction(ctx, 'lock');
  });

  bot.action('service_unlock', async (ctx) => {
    if (!ctx || !ctx.match) return showActionError(ctx);
    await handleServiceAction(ctx, 'unlock');
  });

  bot.action('cek_service', async (ctx) => {
    try {
      await ctx.answerCbQuery().catch(() => {});

      const userId = ctx.from.id;
      const isAdminUser = isAdmin(userId, adminIds);

      let isReseller = false;
      try {
        isReseller = await isUserReseller(userId);
      } catch (e) {
        logger.error('❌ Gagal cek status reseller:', e.message || e);
      }

      if (!isReseller && !isAdminUser) {
        return ctx.reply(
          '❌ *Fitur cek server hanya untuk Reseller dan Admin.*\n\n' +
          'Kalau kamu ingin akses menu cek server & monitoring, kamu bisa daftar sebagai *Reseller* lewat menu yang tersedia atau hubungi admin.',
          { parse_mode: 'Markdown' }
        );
      }

      const loadingMsg = await ctx.reply('⏳ Sedang mengecek status server, mohon tunggu sebentar...');

      exec('chmod +x cek-port.sh && bash cek-port.sh', (error, stdout, stderr) => {
        if (error) {
          logger.error(`Gagal menjalankan skrip cek-port.sh: ${error.message}`);
          return ctx.telegram.editMessageText(
            loadingMsg.chat.id,
            loadingMsg.message_id,
            undefined,
            '❌ Terjadi kesalahan saat menjalankan skrip pengecekan server.',
            { parse_mode: 'Markdown' }
          );
        }

        if (stderr) {
          logger.error(`Error dari skrip cek-port.sh: ${stderr}`);
        }

        let cleanOutput = (stdout || '').replace(/\x1b\[[0-9;]*m/g, '').trim();
        if (!cleanOutput) cleanOutput = 'Tidak ada output dari skrip cek-port.sh.';

        cleanOutput = cleanOutput.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        if (cleanOutput.length > 1500) {
          cleanOutput = cleanOutput.slice(0, 1500) + '\n... (dipotong, output terlalu panjang)';
        }

        const timestamp = new Date().toLocaleString('id-ID', { timeZone: TIME_ZONE });

        const legend =
          '\n\n<b>Keterangan:</b>\n' +
          '• <b>OPEN</b>      : Port terbuka dan layanan merespons dengan baik.\n' +
          '• <b>CLOSED</b>    : Port tertutup atau layanan tidak aktif.\n' +
          '• <b>TIMEOUT</b>   : Tidak ada balasan dari server, kemungkinan gangguan koneksi.';

        const resultText =
          `<b>STATUS SERVER</b>\n` +
          `Waktu cek: <b>${timestamp}</b>\n\n` +
          `<pre>${cleanOutput}</pre>` +
          legend;

        ctx.telegram.editMessageText(
          loadingMsg.chat.id,
          loadingMsg.message_id,
          undefined,
          resultText,
          { parse_mode: 'HTML' }
        );
      });
    } catch (err) {
      logger.error('❌ Error cek_service:', err);
      try {
        await ctx.reply('❌ Gagal menjalankan pengecekan server.');
      } catch (e) {}
    }
  });
}

module.exports = { registerServiceActionHandlers };
