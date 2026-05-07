async function sendAccountPurchaseGroupNotif(ctx, deps) {
  const {
    bot,
    GROUP_ID,
    db,
    logger,
    isUserReseller,
    action,
    username,
    type,
    exp,
    serverId,
  } = deps;

  try {
    let userInfo;
    try {
      userInfo = await bot.telegram.getChat(ctx.from.id);
    } catch (e) {
      userInfo = {};
    }

    let usernameTelegram = userInfo.username || userInfo.first_name || '';
    usernameTelegram = usernameTelegram.trim();
    if (usernameTelegram.startsWith('@')) usernameTelegram = usernameTelegram.slice(1);
    if (!usernameTelegram) usernameTelegram = '-';

    const userDisplay = usernameTelegram;

    let roleLabel = 'Member';
    try {
      const isRes = await isUserReseller(ctx.from.id);
      if (isRes) roleLabel = 'Reseller';
    } catch (e) {}

    let serverName = `Server ID ${serverId}`;
    try {
      const serverRow = await new Promise((resolve) => {
        db.get('SELECT nama_server FROM Server WHERE id = ?', [serverId], (err, row) => {
          if (err) {
            logger.error('Gagal ambil nama_server:', err.message);
            return resolve(null);
          }
          resolve(row);
        });
      });
      if (serverRow && serverRow.nama_server) serverName = serverRow.nama_server;
    } catch (e) {}

    let expiredDateOnly = '-';
    let sisaHari = '-';

    try {
      const accountRow = await new Promise((resolve) => {
        db.get(
          'SELECT created_at, expires_at FROM accounts WHERE username = ? AND server_id = ? AND type = ? ORDER BY id DESC LIMIT 1',
          [username, serverId, type],
          (err, row) => {
            if (err) {
              logger.error('Gagal ambil data akun untuk notif grup:', err.message);
              return resolve(null);
            }
            resolve(row);
          }
        );
      });

      const options = { timeZone: 'Asia/Jayapura', year: 'numeric', month: '2-digit', day: '2-digit' };
      const msPerDay = 24 * 60 * 60 * 1000;

      if (accountRow && accountRow.expires_at) {
        const expiredAtDate = new Date(accountRow.expires_at);
        expiredDateOnly = expiredAtDate.toLocaleDateString('id-ID', options);
        const diffNow = Math.ceil((expiredAtDate.getTime() - Date.now()) / msPerDay);
        sisaHari = diffNow > 0 ? diffNow : 0;
      } else {
        const now = new Date();
        const expiredAt = new Date(now.getTime() + exp * msPerDay);
        expiredDateOnly = expiredAt.toLocaleDateString('id-ID', options);
        sisaHari = exp;
      }
    } catch (e) {
      logger.error('Error hitung tanggal expired untuk notif grup:', e.message);
    }

    const separator = '====================';
    let notifText = '';

    if (action === 'create') {
      notifText =
        '<blockquote>\n' +
        `<code>${separator}</code>\n` +
        '<b>ACCOUNT CREATED</b>\n' +
        `<code>${separator}</code>\n` +
        `<b>${serverName}</b>\n` +
        '<code>\n' +
        `-> Client  : ${userDisplay}\n` +
        `-> Role    : ${roleLabel}\n` +
        `-> User    : <code>${username}</code>\n` +
        `-> Type    : ${type.toUpperCase()}\n` +
        `-> Durasi  : ${exp} Hari\n` +
        `-> Expired : ${expiredDateOnly}\n` +
        '</code>\n' +
        `<code>${separator}</code>\n` +
        '</blockquote>';
    } else {
      const sisaSebelum = Math.max(sisaHari - exp, 0);
      notifText =
        '<blockquote>\n' +
        `<code>${separator}</code>\n` +
        '<b>ACCOUNT RENEWED</b>\n' +
        `<code>${separator}</code>\n` +
        `<b>${serverName}</b>\n` +
        '<code>\n' +
        `-> Client  : ${userDisplay}\n` +
        `-> Role    : ${roleLabel}\n` +
        `-> User    : <code>${username}</code>\n` +
        `-> Type    : ${type.toUpperCase()}\n` +
        `-> Sisa sebelum : ${sisaSebelum} Hari\n` +
        `-> Perpanjang   : +${exp} Hari\n` +
        `-> Sisa sekarang: ${sisaHari} Hari\n` +
        `-> Expired      : ${expiredDateOnly}\n` +
        '</code>\n' +
        `<code>${separator}</code>\n` +
        '</blockquote>';
    }

    await bot.telegram.sendMessage(GROUP_ID, notifText, { parse_mode: 'HTML' });
  } catch (e) {
    logger.error('Gagal kirim notif pembelian ke grup:', e.message);
  }
}

module.exports = { sendAccountPurchaseGroupNotif };
