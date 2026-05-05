const { getUserById, setUserRole } = require('../../repositories/userRepository');
const { listPendingQrisPaymentsByUser } = require('../../repositories/qrisPaymentRepository');
const { createTopupInvoice, finalizeInvoiceAsPaid } = require('../../services/qrisService');
const { getEffectiveRole, canAccessAdmin, canAccessReseller } = require('../../services/roleService');
const { buildMainMenuText, buildMainKeyboard, formatRupiah } = require('../ui/mainMenu');

const stateByUser = new Map();

function setState(userId, state) {
  stateByUser.set(userId, state);
}

function clearState(userId) {
  stateByUser.delete(userId);
}

function getState(userId) {
  return stateByUser.get(userId) || null;
}

async function renderMainMenu(ctx, db) {
  const row = await getUserById(db, ctx.from.id);
  if (!row) {
    return ctx.reply('User tidak ditemukan. Jalankan /start dulu.');
  }

  const role = getEffectiveRole(row.user_id, row.role);
  const text = buildMainMenuText({
    userId: row.user_id,
    name: row.first_name,
    role,
    saldo: row.saldo,
  });

  const extra = {
    parse_mode: 'HTML',
    reply_markup: buildMainKeyboard(role),
  };

  if (ctx.callbackQuery) {
    try {
      return await ctx.editMessageText(text, extra);
    } catch (_) {
      return ctx.reply(text, extra);
    }
  }

  return ctx.reply(text, extra);
}

function registerMenuHandlers(bot, db) {
  bot.action('menu:home', async (ctx) => {
    await ctx.answerCbQuery();
    return renderMainMenu(ctx, db);
  });

  bot.action('menu:help', async (ctx) => {
    await ctx.answerCbQuery();
    const text = [
      '<b>Bantuan</b>',
      '',
      '1) Topup QRIS: masuk ke menu Topup lalu kirim nominal.',
      '2) Admin bisa konfirmasi invoice via /payok <invoice_id>.',
      '3) Cek profil: /me, cek saldo: /saldo.',
      '',
      'Gunakan /menu untuk kembali ke dashboard utama.',
    ].join('\n');
    return ctx.reply(text, {
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: [[{ text: 'Kembali', callback_data: 'menu:home' }]] },
    });
  });

  bot.action('menu:saldo', async (ctx) => {
    await ctx.answerCbQuery();
    const row = await getUserById(db, ctx.from.id);
    if (!row) return ctx.reply('User tidak ditemukan.');
    return ctx.reply(`Saldo kamu: <b>${formatRupiah(row.saldo)}</b>`, {
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: [[{ text: 'Kembali', callback_data: 'menu:home' }]] },
    });
  });

  bot.action('menu:topup', async (ctx) => {
    await ctx.answerCbQuery();
    setState(ctx.from.id, { step: 'await_topup_amount' });
    return ctx.reply(
      [
        '<b>Topup QRIS</b>',
        '',
        'Kirim nominal topup dalam angka saja.',
        'Contoh: <code>50000</code>',
        '',
        'Ketik <code>batal</code> untuk membatalkan.',
      ].join('\n'),
      { parse_mode: 'HTML' }
    );
  });

  bot.action('menu:create', async (ctx) => {
    await ctx.answerCbQuery('Segera: flow create akun modular');
    return ctx.reply('Flow create akun akan jadi modul berikutnya. Pondasi data sudah siap.');
  });

  bot.action('menu:accounts', async (ctx) => {
    await ctx.answerCbQuery('Segera: list akun user');
    return ctx.reply('List akun user akan dihubungkan ke modul provisioning akun.');
  });

  bot.action('menu:reseller', async (ctx) => {
    await ctx.answerCbQuery();
    const row = await getUserById(db, ctx.from.id);
    const role = getEffectiveRole(ctx.from.id, row ? row.role : 'member');
    if (!canAccessReseller(role)) {
      return ctx.reply('Kamu belum punya akses reseller.');
    }

    const pending = await listPendingQrisPaymentsByUser(db, ctx.from.id);
    const text = [
      '<b>Panel Reseller</b>',
      '',
      `Role kamu: <b>${role}</b>`,
      `Pending invoice topup: <b>${pending.length}</b>`,
      '',
      'Menu reseller lanjutan (harga reseller, penjualan, target) akan ditambah di tahap berikut.',
    ].join('\n');

    return ctx.reply(text, {
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: [[{ text: 'Kembali', callback_data: 'menu:home' }]] },
    });
  });

  bot.action('menu:admin', async (ctx) => {
    await ctx.answerCbQuery();
    const row = await getUserById(db, ctx.from.id);
    const role = getEffectiveRole(ctx.from.id, row ? row.role : 'member');
    if (!canAccessAdmin(role)) {
      return ctx.reply('Menu ini hanya untuk admin.');
    }

    const text = [
      '<b>Panel Admin</b>',
      '',
      'Command penting:',
      '• /setrole <user_id> <member|reseller>',
      '• /payok <invoice_id> (simulasi settlement)',
      '• /menu kembali ke menu utama',
    ].join('\n');

    return ctx.reply(text, {
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: [[{ text: 'Kembali', callback_data: 'menu:home' }]] },
    });
  });

  bot.command('setrole', async (ctx) => {
    const row = await getUserById(db, ctx.from.id);
    const actorRole = getEffectiveRole(ctx.from.id, row ? row.role : 'member');
    if (!canAccessAdmin(actorRole)) {
      return ctx.reply('Tidak punya akses.');
    }

    const parts = String(ctx.message.text || '').trim().split(/\s+/);
    if (parts.length !== 3) {
      return ctx.reply('Format: /setrole <user_id> <member|reseller>');
    }

    const targetId = Number(parts[1]);
    const role = String(parts[2] || '').toLowerCase();
    if (!targetId || !['member', 'reseller'].includes(role)) {
      return ctx.reply('Parameter tidak valid.');
    }

    const res = await setUserRole(db, targetId, role);
    if (!res.changes) return ctx.reply('User target tidak ditemukan.');
    return ctx.reply(`Role user ${targetId} diubah menjadi ${role}.`);
  });

  bot.command('payok', async (ctx) => {
    const row = await getUserById(db, ctx.from.id);
    const actorRole = getEffectiveRole(ctx.from.id, row ? row.role : 'member');
    if (!canAccessAdmin(actorRole)) {
      return ctx.reply('Tidak punya akses.');
    }

    const parts = String(ctx.message.text || '').trim().split(/\s+/);
    if (parts.length < 2) {
      return ctx.reply('Format: /payok <invoice_id>');
    }

    const invoiceId = parts[1];
    const result = await finalizeInvoiceAsPaid(db, {
      invoiceId,
      providerRef: `manual_${ctx.from.id}_${Date.now()}`,
    });

    if (!result.ok && result.reason) {
      return ctx.reply(`Gagal finalize invoice: ${result.reason}`);
    }

    if (result.alreadyPaid) {
      return ctx.reply(`Invoice ${invoiceId} sudah paid sebelumnya.`);
    }

    try {
      await ctx.telegram.sendMessage(
        result.userId,
        `Topup berhasil. Nominal masuk: ${formatRupiah(result.amount)}. Saldo terbaru: ${formatRupiah(result.saldo)}.`
      );
    } catch (_) {}

    return ctx.reply(`Invoice ${invoiceId} berhasil di-set PAID.`);
  });

  bot.on('text', async (ctx, next) => {
    const current = getState(ctx.from.id);
    if (!current) return next();

    const text = String(ctx.message.text || '').trim().toLowerCase();
    if (text === 'batal') {
      clearState(ctx.from.id);
      await ctx.reply('Input topup dibatalkan.');
      return renderMainMenu(ctx, db);
    }

    if (current.step !== 'await_topup_amount') return next();

    const amount = Number(String(ctx.message.text || '').replace(/[^0-9]/g, ''));
    if (!Number.isFinite(amount) || amount < 10000 || amount > 5000000) {
      return ctx.reply('Nominal tidak valid. Min 10.000, maks 5.000.000.');
    }

    const invoice = await createTopupInvoice(db, ctx.from.id, amount);
    clearState(ctx.from.id);

    return ctx.reply(
      [
        '<b>Invoice Topup Dibuat</b>',
        '',
        `Invoice: <code>${invoice.invoiceId}</code>`,
        `Nominal: <b>${formatRupiah(invoice.amount)}</b>`,
        `Kode unik: <b>${invoice.uniqueCode}</b>`,
        `Transfer: <b>${formatRupiah(invoice.totalAmount)}</b>`,
        `Expired: <b>${new Date(invoice.expiresAt).toLocaleString('id-ID')}</b>`,
        '',
        'Catatan: Integrasi provider QRIS live tinggal sambungkan endpoint generate/status di tahap berikutnya.',
      ].join('\n'),
      {
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: [[{ text: 'Kembali', callback_data: 'menu:home' }]] },
      }
    );
  });
}

module.exports = {
  registerMenuHandlers,
  renderMainMenu,
};
