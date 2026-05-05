const lastMenuMsgId = new Map();

async function sendCleanMenu(ctx, text, extra = {}) {
  const userId = ctx.from?.id;
  if (!userId) return;

  if (ctx.callbackQuery && ctx.update?.callback_query?.message) {
    try {
      await ctx.editMessageText(text, { parse_mode: 'HTML', ...extra });
      const mid = ctx.update.callback_query.message.message_id;
      lastMenuMsgId.set(userId, mid);
      return;
    } catch (e) {
      // Fallback to delete/send when edit fails.
    }
  }

  const prevId = lastMenuMsgId.get(userId);
  if (prevId) {
    try {
      await ctx.telegram.deleteMessage(ctx.chat.id, prevId);
    } catch (e) {
      // Ignore delete failures (old message, group permissions, etc.).
    }
  }

  const sent = await ctx.reply(text, { parse_mode: 'HTML', ...extra });
  if (sent?.message_id) lastMenuMsgId.set(userId, sent.message_id);
}

module.exports = {
  sendCleanMenu,
};
