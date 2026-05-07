function createQrisNotificationService({ getUserSaldo, rupiah, notifTopupGroup, groupId, groupTimeZone }) {
  async function notifyTopupSuccess({ bot, db, userId, baseAmount, bonusAmount, percent, ref, method }) {
    const total = Number(baseAmount || 0) + Number(bonusAmount || 0);
    const saldoNow = await getUserSaldo(db, userId);

    let who = `UID:${userId}`;
    try {
      const chat = await bot.telegram.getChat(userId);
      if (chat?.username) who = `@${chat.username}`;
      else if (chat?.first_name) who = chat.first_name;
    } catch (_) {}

    const lines = [];
    lines.push('✅ <b>TOPUP BERHASIL</b>');
    lines.push(`Metode: <b>${method || 'QRIS'}</b>`);
    lines.push(`Nominal: <b>${rupiah(baseAmount)}</b>`);
    if (Number(bonusAmount) > 0) {
      lines.push(`Bonus: <b>${rupiah(bonusAmount)}</b> <i>(${percent || 0}%)</i>`);
    }
    lines.push(`Total masuk: <b>${rupiah(total)}</b>`);
    if (saldoNow != null) lines.push(`Saldo sekarang: <b>${rupiah(saldoNow)}</b>`);
    lines.push(`Ref: <code>${ref}</code>`);
    lines.push('\nTerima kasih 🙏');

    try {
      await bot.telegram.sendMessage(userId, lines.join('\n'), { parse_mode: 'HTML' });
    } catch (_) {}

    try {
      if (notifTopupGroup && groupId) {
        const saldoMasuk = Number(baseAmount || 0) + Number(bonusAmount || 0);
        const gLines = [];
        gLines.push('✅ <b>TOPUP SUCCESS</b>');
        gLines.push('━━━━━━━━━━━━━━━━━━');
        gLines.push(`👤 <b>User:</b> ${who}`);
        gLines.push(`🆔 <b>ID:</b> <code>${userId}</code>`);
        gLines.push('💳 <b>Metode:</b> QRIS');
        gLines.push(`💰 <b>Nominal:</b> ${rupiah(baseAmount)}`);
        gLines.push(`🎁 <b>Bonus:</b> ${rupiah(bonusAmount || 0)}`);
        gLines.push(`📥 <b>Saldo Masuk:</b> ${rupiah(saldoMasuk)}`);
        gLines.push(`🧾 <b>Ref:</b> <code>${ref}</code>`);
        gLines.push(`🕒 <b>Waktu:</b> ${new Date().toLocaleString('id-ID', { timeZone: groupTimeZone || 'Asia/Jayapura' })}`);
        gLines.push('━━━━━━━━━━━━━━━━━━');
        await bot.telegram.sendMessage(groupId, gLines.join('\n'), { parse_mode: 'HTML' });
      }
    } catch (_) {}
  }

  async function notifyTopupExpired({ bot, userId, ref }) {
    const txt =
      `⏰ <b>QRIS Expired</b>\n` +
      `Ref: <code>${ref}</code>\n` +
      'QRIS kamu sudah lewat batas waktu.\n' +
      'Silakan buat QRIS baru dari menu topup.';
    try {
      await bot.telegram.sendMessage(userId, txt, { parse_mode: 'HTML' });
    } catch (_) {}
  }

  return { notifyTopupSuccess, notifyTopupExpired };
}

module.exports = { createQrisNotificationService };
