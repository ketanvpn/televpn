const { upsertUser, getUserById } = require('../../repositories/userRepository');
const { getEffectiveRole } = require('../../services/roleService');
const { renderMainMenu } = require('./menuHandlers');

function registerBasicCommands(bot, db) {
  bot.command(['start', 'menu'], async (ctx) => {
    const tgUser = ctx.from;
    await upsertUser(db, tgUser);
    return renderMainMenu(ctx, db);
  });

  bot.command('me', async (ctx) => {
    const row = await getUserById(db, ctx.from.id);
    if (!row) {
      return ctx.reply('User not found. Run /start first.');
    }

    const role = getEffectiveRole(ctx.from.id, row.role);
    return ctx.reply(
      [
        `ID: ${row.user_id}`,
        `Name: ${row.first_name || '-'}`,
        `Username: ${row.username ? '@' + row.username : '-'}`,
        `Role: ${role}`,
      ].join('\n')
    );
  });

  bot.command('saldo', async (ctx) => {
    const row = await getUserById(db, ctx.from.id);
    if (!row) {
      return ctx.reply('User not found. Run /start first.');
    }

    return ctx.reply(`Saldo: Rp${Number(row.saldo || 0).toLocaleString('id-ID')}`);
  });
}

module.exports = { registerBasicCommands };
