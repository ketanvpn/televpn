const { insertResellerServer } = require('../../repositories/serverRepository');

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

    try {
      await insertResellerServer(db, {
        domain: state.domain,
        auth: state.auth,
        harga: parseInt(state.harga, 10),
        nama_server: state.nama_server,
        quota: parseInt(state.quota, 10),
        iplimit: parseInt(state.iplimit, 10),
        batas_create_akun: parseInt(state.batas_create_akun, 10),
      });
      await ctx.reply(`✅ Server reseller *${state.nama_server}* berhasil ditambahkan!`, { parse_mode: 'Markdown' });
    } catch (err) {
      logger.error('❌ Gagal menambah server reseller:', err.message);
      await ctx.reply('❌ Gagal menambah server reseller.');
    }
    delete userState[ctx.chat.id];
    return true;
  }

  return false;
}

module.exports = { handleTextResellerAddServerFlow };
