function ensurePrivateChat(ctx) {
  const chatType = ctx.chat?.type;

  if (chatType && chatType !== 'private') {
    ctx.reply(
      '📩 Perintah ini hanya bisa digunakan di chat pribadi dengan bot.\n' +
      'Silakan klik nama bot ini lalu tekan tombol <b>Start</b>.',
      { parse_mode: 'HTML' }
    ).catch((e) => {
      console.error('❌ Gagal kirim instruksi private chat:', e.message);
    });

    return false;
  }

  return true;
}

module.exports = {
  ensurePrivateChat,
};
