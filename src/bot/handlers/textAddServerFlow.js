async function handleTextAddServerFlow(ctx, deps) {
  const { state, text, db, logger, userState } = deps;

  if (state.step === 'addserver') {
    const domain = text.trim();
    if (!domain) {
      await ctx.reply('⚠️ *Domain tidak boleh kosong.* Silakan masukkan domain server yang valid.', { parse_mode: 'Markdown' });
      return true;
    }
    state.step = 'addserver_auth';
    state.domain = domain;
    await ctx.reply('🔒 *Silakan masukkan auth server:*', { parse_mode: 'Markdown' });
    return true;
  }

  if (state.step === 'addserver_auth') {
    const auth = text.trim();
    if (!auth) {
      await ctx.reply('⚠️ *Auth tidak boleh kosong.* Silakan masukkan auth server yang valid.', { parse_mode: 'Markdown' });
      return true;
    }
    state.step = 'addserver_nama_server';
    state.auth = auth;
    await ctx.reply('🖖️ *Silakan masukkan nama server:*', { parse_mode: 'Markdown' });
    return true;
  }

  if (state.step === 'addserver_nama_server') {
    const namaServer = text.trim();
    if (!namaServer) {
      await ctx.reply('⚠️ *Nama server tidak boleh kosong.* Silakan masukkan nama server yang valid.', { parse_mode: 'Markdown' });
      return true;
    }
    state.step = 'addserver_quota';
    state.nama_server = namaServer;
    await ctx.reply('📈 *Silakan masukkan quota server (dalam GB, contoh: 500):*', { parse_mode: 'Markdown' });
    return true;
  }

  if (state.step === 'addserver_quota') {
    const quota = parseInt(text.trim(), 10);
    if (isNaN(quota) || quota <= 0) {
      await ctx.reply(
        '⚠️ *Quota tidak valid.* Quota harus berupa angka dan lebih besar dari 0.\nContoh: `500` (untuk 500 GB).',
        { parse_mode: 'Markdown' }
      );
      return true;
    }
    state.step = 'addserver_iplimit';
    state.quota = quota;
    await ctx.reply('📳 *Silakan masukkan limit IP server:*', { parse_mode: 'Markdown' });
    return true;
  }

  if (state.step === 'addserver_iplimit') {
    const iplimit = parseInt(text.trim(), 10);
    if (isNaN(iplimit) || iplimit <= 0) {
      await ctx.reply(
        '⚠️ *Limit IP tidak valid.* Limit IP harus berupa angka dan lebih besar dari 0.\nContoh: `1` atau `2`.',
        { parse_mode: 'Markdown' }
      );
      return true;
    }
    state.step = 'addserver_batas_create_akun';
    state.iplimit = iplimit;
    await ctx.reply('📳 *Silakan masukkan batas create akun server:*', { parse_mode: 'Markdown' });
    return true;
  }

  if (state.step === 'addserver_batas_create_akun') {
    const batasCreateAkun = parseInt(text.trim(), 10);
    if (isNaN(batasCreateAkun) || batasCreateAkun <= 0) {
      await ctx.reply(
        '⚠️ *Batas create akun tidak valid.* Nilai harus berupa angka dan lebih besar dari 0.\nContoh: `100` (maksimal 100 akun).',
        { parse_mode: 'Markdown' }
      );
      return true;
    }
    state.step = 'addserver_harga';
    state.batas_create_akun = batasCreateAkun;
    await ctx.reply(
      '💰 *Silakan masukkan harga server untuk paket 30 hari* (dalam rupiah, tanpa titik. Contoh: 12000):',
      { parse_mode: 'Markdown' }
    );
    return true;
  }

  if (state.step === 'addserver_harga') {
    const harga = parseFloat(text.trim());
    if (isNaN(harga) || harga <= 0) {
      await ctx.reply('⚠️ *Harga tidak valid.* Silakan masukkan harga server yang valid.', { parse_mode: 'Markdown' });
      return true;
    }

    const { domain, auth, nama_server, quota, iplimit, batas_create_akun } = state;
    try {
      await new Promise((resolve) => {
        db.run(
          'INSERT INTO Server (domain, auth, nama_server, quota, iplimit, batas_create_akun, harga, total_create_akun) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          [domain, auth, nama_server, quota, iplimit, batas_create_akun, harga, 0],
          (err) => {
            if (err) {
              logger.error('Error saat menambahkan server:', err.message);
              ctx.reply('❌ *Terjadi kesalahan saat menambahkan server baru.*', { parse_mode: 'Markdown' });
            } else {
              ctx.reply(
                `✅ *Server baru dengan domain ${domain} telah berhasil ditambahkan.*\n\n📤 *Detail Server:*\n- Domain: ${domain}\n- Auth: ${auth}\n- Nama Server: ${nama_server}\n- Quota: ${quota}\n- Limit IP: ${iplimit}\n- Batas Create Akun: ${batas_create_akun}\n- Harga: Rp ${harga}`,
                { parse_mode: 'Markdown' }
              );
            }
            resolve();
          }
        );
      });
    } catch (error) {
      logger.error('Error saat menambahkan server:', error);
      await ctx.reply('❌ *Terjadi kesalahan saat menambahkan server baru.*', { parse_mode: 'Markdown' });
    }

    delete userState[ctx.chat.id];
    return true;
  }

  return false;
}

module.exports = { handleTextAddServerFlow };
