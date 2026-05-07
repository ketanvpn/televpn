async function handleResellerUsernameOps(ctx, deps) {
  const {
    state,
    text,
    fs,
    userState,
    logger,
    recordAccountTransaction,
    unlockvmess,
    unlockvless,
    unlocktrojan,
    unlockshadowsocks,
    unlockssh,
    lockvmess,
    lockvless,
    locktrojan,
    lockshadowsocks,
    lockssh,
    delvmess,
    delvless,
    deltrojan,
    delshadowsocks,
    delssh,
  } = deps;

  let mode = null;
  if (state.step.startsWith('username_unlock_')) mode = 'unlock';
  else if (state.step.startsWith('username_lock_')) mode = 'lock';
  else if (state.step.startsWith('username_del_')) mode = 'del';

  if (!mode) return false;

  const username = text;
  if (!/^[a-z0-9]{3,20}$/.test(username)) {
    await ctx.reply('❌ *Username tidak valid. Gunakan huruf kecil dan angka (3–20 karakter).*', { parse_mode: 'Markdown' });
    return true;
  }

  let data;
  try {
    data = await new Promise((resolve, reject) => {
      fs.readFile('./ressel.db', 'utf8', (err, content) => {
        if (err) return reject(err);
        resolve(content || '');
      });
    });
  } catch (err) {
    logger.error('❌ Gagal membaca file ressel.db:', err.message);
    await ctx.reply('❌ *Terjadi kesalahan saat membaca data reseller.*', { parse_mode: 'Markdown' });
    return true;
  }

  const idUser = String(ctx.from.id).trim();
  const resselList = data.split('\n').map((line) => line.trim()).filter(Boolean);
  const isRessel = resselList.includes(idUser);

  if (!isRessel) {
    await ctx.reply('❌ *Fitur ini hanya untuk Ressel VPN.*', { parse_mode: 'Markdown' });
    return true;
  }

  const { type, serverId } = state;
  delete userState[ctx.chat.id];

  const fnMaps = {
    unlock: {
      vmess: unlockvmess,
      vless: unlockvless,
      trojan: unlocktrojan,
      shadowsocks: unlockshadowsocks,
      ssh: unlockssh,
    },
    lock: {
      vmess: lockvmess,
      vless: lockvless,
      trojan: locktrojan,
      shadowsocks: lockshadowsocks,
      ssh: lockssh,
    },
    del: {
      vmess: delvmess,
      vless: delvless,
      trojan: deltrojan,
      shadowsocks: delshadowsocks,
      ssh: delssh,
    },
  };

  const labels = {
    unlock: 'unlock',
    lock: 'di kunci',
    del: 'dihapus',
  };

  try {
    const fn = fnMaps[mode][type];
    let msg = 'none';
    if (fn) {
      msg = await fn(username, 'none', 'none', 'none', serverId);
      await recordAccountTransaction(ctx.from.id, type);
    }

    await ctx.reply(msg, { parse_mode: 'Markdown' });
    logger.info(`✅ Akun ${type} berhasil ${labels[mode]} oleh ${ctx.from.id}`);
  } catch (err) {
    logger.error('❌ Gagal proses akun reseller:', err.message);
    await ctx.reply('❌ *Terjadi kesalahan saat memproses akun.*', { parse_mode: 'Markdown' });
  }

  return true;
}

module.exports = { handleResellerUsernameOps };
