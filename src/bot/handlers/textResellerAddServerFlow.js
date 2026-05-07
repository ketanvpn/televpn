async function handleTextResellerAddServerFlow(ctx, deps) {
  const { state, text, db, logger, userState } = deps;

  if (state && state.step === 'reseller_domain') {
    state.domain = text;
    state.step = 'reseller_auth';
    await ctx.reply('🔒 Masukkan auth server:');
    return true;
  }

  if (state && state.step === 'reseller_auth') {
    state.auth = text;
    state.step = 'reseller_harga';
    await ctx.reply('💰 Masukkan harga server (angka):');
    return true;
  }

  if (state && state.step === 'reseller_harga') {
    state.harga = text;
    state.step = 'reseller_nama';
    await ctx.reply('📥 Masukkan nama server:');
    return true;
  }

  if (state && state.step === 'reseller_nama') {
    state.nama_server = text;
    state.step = 'reseller_quota';
    await ctx.reply('📈 Masukkan quota (GB):');
    return true;
  }

  if (state && state.step === 'reseller_quota') {
    state.quota = text;
    state.step = 'reseller_iplimit';
    await ctx.reply('📢 Masukkan IP limit:');
    return true;
  }

  if (state && state.step === 'reseller_iplimit') {
    state.iplimit = text;
    state.step = 'reseller_batas';
    await ctx.reply('📳 Masukkan batas create akun:');
    return true;
  }

  if (state && state.step === 'reseller_batas') {
    state.batas_create_akun = text;

    db.run(
      `INSERT INTO Server (domain, auth, harga, nama_server, quota, iplimit, batas_create_akun, total_create_akun, is_reseller_only)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0, 1)`,
      [
        state.domain,
        state.auth,
        parseInt(state.harga, 10),
        state.nama_server,
        parseInt(state.quota, 10),
        parseInt(state.iplimit, 10),
        parseInt(state.batas_create_akun, 10),
      ],
      (err) => {
        if (err) {
          logger.error('❌ Gagal menambah server reseller:', err.message);
          ctx.reply('❌ Gagal menambah server reseller.');
        } else {
          ctx.reply(`✅ Server reseller *${state.nama_server}* berhasil ditambahkan!`, { parse_mode: 'Markdown' });
        }
        delete userState[ctx.chat.id];
      }
    );
    return true;
  }

  return false;
}

module.exports = { handleTextResellerAddServerFlow };
