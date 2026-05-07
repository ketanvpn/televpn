async function handleTextAccountInputSteps(ctx, deps) {
  const { state, text } = deps;

  if (state.step.startsWith('username_')) {
    state.username = text;

    if (!state.username) {
      await ctx.reply('❌ *Username tidak valid. Masukkan username yang valid.*', { parse_mode: 'Markdown' });
      return true;
    }
    if (state.username.length < 4 || state.username.length > 20) {
      await ctx.reply('❌ *Username harus terdiri dari 4 hingga 20 karakter.*', { parse_mode: 'Markdown' });
      return true;
    }
    if (/[A-Z]/.test(state.username)) {
      await ctx.reply('❌ *Username tidak boleh menggunakan huruf kapital. Gunakan huruf kecil saja.*', { parse_mode: 'Markdown' });
      return true;
    }
    if (/[^a-z0-9]/.test(state.username)) {
      await ctx.reply('❌ *Username tidak boleh mengandung karakter khusus atau spasi. Gunakan huruf kecil dan angka saja.*', { parse_mode: 'Markdown' });
      return true;
    }

    const { type, action } = state;
    if (action === 'create') {
      if (type === 'ssh') {
        state.step = `password_${state.action}_${state.type}`;
        await ctx.reply('🔒 *Masukkan password:*', { parse_mode: 'Markdown' });
      } else {
        state.step = `exp_${state.action}_${state.type}`;
        await ctx.reply('⏱ *Masukkan masa aktif (hari):*', { parse_mode: 'Markdown' });
      }
      return true;
    }

    if (action === 'renew') {
      state.step = `exp_${state.action}_${state.type}`;
      await ctx.reply('⏱ *Masukkan masa aktif (hari):*', { parse_mode: 'Markdown' });
      return true;
    }

    return true;
  }

  if (state.step.startsWith('password_')) {
    state.password = ctx.message.text.trim();
    if (!state.password) {
      await ctx.reply('❌ *Password tidak valid. Masukkan password yang valid.*', { parse_mode: 'Markdown' });
      return true;
    }
    if (state.password.length < 3) {
      await ctx.reply('❌ *Password harus terdiri dari minimal 3 karakter.*', { parse_mode: 'Markdown' });
      return true;
    }
    if (/[^a-zA-Z0-9]/.test(state.password)) {
      await ctx.reply('❌ *Password tidak boleh mengandung karakter khusus atau spasi.*', { parse_mode: 'Markdown' });
      return true;
    }

    state.step = `exp_${state.action}_${state.type}`;
    await ctx.reply('⏱ *Masukkan masa aktif (hari):*', { parse_mode: 'Markdown' });
    return true;
  }

  return false;
}

module.exports = { handleTextAccountInputSteps };
