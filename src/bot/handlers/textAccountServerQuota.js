const { getServerQuotaAndIpLimitById } = require('../../repositories/serverRepository');

async function resolveAccountServerQuota(ctx, deps) {
  const { state, db, logger } = deps;

  const server = await getServerQuotaAndIpLimitById(db, state.serverId).catch(async (err) => {
    logger.error('⚠️ Error fetching server details:', err.message);
    await ctx.reply('❌ *Terjadi kesalahan saat mengambil detail server.*', { parse_mode: 'Markdown' });
    return null;
  });

  if (!server) {
    await ctx.reply('❌ *Server tidak ditemukan.*', { parse_mode: 'Markdown' });
    return { ok: false };
  }

  const baseQuota = server.quota;
  const days = state.exp || 30;
  let computedQuota = baseQuota;

  if (baseQuota && baseQuota > 0) {
    computedQuota = Math.max(1, Math.floor((baseQuota * days) / 30));
  }

  state.quota = computedQuota;
  state.iplimit = server.iplimit;

  return { ok: true, quota: state.quota, iplimit: state.iplimit };
}

module.exports = { resolveAccountServerQuota };
