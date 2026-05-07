function registerMyMenuHandlers(bot, deps) {
  const { showMyAccounts, showMyStatsPage } = deps;

  bot.action('my_accounts', async (ctx) => {
    return showMyAccounts(ctx, 'active');
  });

  bot.action('my_accounts_active', async (ctx) => showMyAccounts(ctx, 'active', 0));
  bot.action('my_accounts_expired', async (ctx) => showMyAccounts(ctx, 'expired', 0));
  bot.action('my_accounts_all', async (ctx) => showMyAccounts(ctx, 'all', 0));

  bot.action(/^myacc_page:(active|expired|all):(\d+)$/, async (ctx) => {
    const filter = ctx.match[1];
    const page = parseInt(ctx.match[2], 10) || 0;
    return showMyAccounts(ctx, filter, page);
  });

  bot.action('my_stats', async (ctx) => {
    return showMyStatsPage(ctx, 0);
  });

  bot.action(/my_stats:(\d+)/, async (ctx) => {
    const page = parseInt(ctx.match[1], 10) || 0;
    return showMyStatsPage(ctx, page);
  });
}

module.exports = { registerMyMenuHandlers };
