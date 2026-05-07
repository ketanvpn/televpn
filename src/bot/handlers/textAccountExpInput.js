async function handleTextAccountExpInput(ctx, deps) {
  const { state } = deps;

  if (!state.step.startsWith('exp_')) return { handled: false };

  const expInput = ctx.message.text.trim();

  if (!/^\d+$/.test(expInput)) {
    await ctx.reply('❌ *Masa aktif hanya boleh angka, contoh: 30*', { parse_mode: 'Markdown' });
    return { handled: true, valid: false };
  }

  const exp = parseInt(expInput, 10);

  if (isNaN(exp) || exp <= 0) {
    await ctx.reply('❌ *Masa aktif tidak valid. Masukkan angka yang valid.*', { parse_mode: 'Markdown' });
    return { handled: true, valid: false };
  }

  if (exp > 365) {
    await ctx.reply('❌ *Masa aktif tidak boleh lebih dari 365 hari.*', { parse_mode: 'Markdown' });
    return { handled: true, valid: false };
  }

  state.exp = exp;
  return { handled: true, valid: true, exp };
}

module.exports = { handleTextAccountExpInput };
