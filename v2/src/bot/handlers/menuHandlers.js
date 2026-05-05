const { getUserById, setUserRole } = require('../../repositories/userRepository');
const { listPendingQrisPaymentsByUser } = require('../../repositories/qrisPaymentRepository');
const { listAccountsByUser, createAccountRecord, getLatestAccountByUserTypeUsername, updateAccountExpiry, markAccountDeleted } = require('../../repositories/accountRepository');
const { listActiveServers, createServer } = require('../../repositories/serverRepository');
const { createTopupInvoice, finalizeInvoiceAsPaid, checkInvoiceStatus } = require('../../services/qrisService');
const { getEffectiveRole, canAccessAdmin, canAccessReseller } = require('../../services/roleService');
const { createPaidAccount, createTrialAccount, renewAccount, deleteAccountOnProvider } = require('../../services/provisioningService');
const { adjustSaldoWithLedger } = require('../../services/walletService');
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
      '2) Cek status invoice: <code>/cekqris &lt;invoice_id&gt;</code>.',
      '3) Admin bisa konfirmasi manual fallback via <code>/payok &lt;invoice_id&gt;</code>.',
      '4) Cek profil: /me, cek saldo: /saldo.',
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
    await ctx.answerCbQuery();
    const text = [
      '<b>Buat Akun VPN</b>',
      '',
      'Gunakan command ini:',
      '<code>/create [type] [username] [days] [server_id]</code>',
      'Contoh: <code>/create vmess userbaru 30 1</code>',
      '',
      'Type: ssh | vmess | vless | trojan',
      '',
      'Lihat daftar server: <code>/servers</code>',
    ].join('\n');
    return ctx.reply(text, { parse_mode: 'HTML' });
  });

  bot.action('menu:accounts', async (ctx) => {
    await ctx.answerCbQuery();
    const rows = await listAccountsByUser(db, ctx.from.id, 20);
    if (!rows.length) return ctx.reply('Belum ada akun tercatat.');

    const lines = ['<b>Akun Saya</b>', ''];
    rows.forEach((acc, i) => {
      const exp = acc.expires_at ? new Date(acc.expires_at).toLocaleDateString('id-ID') : '-';
      lines.push(`${i + 1}. <b>${String(acc.type || '').toUpperCase()}</b> <code>${acc.username}</code> | server: ${acc.server_name || acc.server_id || '-'} | exp: ${exp} | status: ${acc.status}`);
    });

    return ctx.reply(lines.join('\n'), { parse_mode: 'HTML' });
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
      '• <code>/setrole &lt;user_id&gt; &lt;member|reseller&gt;</code>',
      '• <code>/addserver &lt;name&gt;|&lt;domain&gt;|&lt;auth&gt;|&lt;price&gt;|&lt;reseller_only 0/1&gt;</code>',
      '• <code>/servers</code> (lihat daftar server)',
      '• <code>/trial &lt;type&gt; &lt;server_id&gt;</code>',
      '• <code>/renew &lt;type&gt; &lt;username&gt; &lt;days&gt; &lt;server_id&gt;</code>',
      '• <code>/delete &lt;type&gt; &lt;username&gt; &lt;server_id&gt;</code>',
      '• <code>/payok &lt;invoice_id&gt;</code> (simulasi settlement)',
      '• <code>/cekqris &lt;invoice_id&gt;</code> (cek status invoice)',
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
      return ctx.reply('Format: /setrole [user_id] [member|reseller]');
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

  bot.command('addserver', async (ctx) => {
    const row = await getUserById(db, ctx.from.id);
    const actorRole = getEffectiveRole(ctx.from.id, row ? row.role : 'member');
    if (!canAccessAdmin(actorRole)) return ctx.reply('Tidak punya akses.');

    const raw = String(ctx.message.text || '').replace(/^\/addserver\s*/i, '').trim();
    const parts = raw.split('|').map((x) => x.trim());
    if (parts.length < 5) {
      return ctx.reply('Format: /addserver [name]|[domain]|[auth]|[price]|[reseller_only 0/1]');
    }

    const [name, domain, authToken, priceRaw, resellerOnlyRaw] = parts;
    const price = Number(priceRaw || 0);
    const isResellerOnly = String(resellerOnlyRaw) === '1';
    const res = await createServer(db, { name, domain, authToken, price, isResellerOnly });
    return ctx.reply(`Server ditambahkan. ID: ${res.lastID}`);
  });

  bot.command('servers', async (ctx) => {
    const list = await listActiveServers(db);
    if (!list.length) return ctx.reply('Belum ada server aktif.');
    const lines = ['Daftar Server:'];
    list.forEach((s) => {
      lines.push(`#${s.id} | ${s.name} | ${s.domain || '-'} | harga ${formatRupiah(s.price)} | reseller_only=${s.is_reseller_only}`);
    });
    return ctx.reply(lines.join('\n'));
  });

  bot.command('create', async (ctx) => {
    const parts = String(ctx.message.text || '').trim().split(/\s+/);
    if (parts.length < 5) {
      return ctx.reply('Format: /create [type] [username] [days] [server_id]');
    }

    const type = String(parts[1] || '').toLowerCase();
    const username = parts[2];
    const days = Number(parts[3] || 0);
    const serverId = Number(parts[4] || 0);
    const password = `pw${Math.floor(Math.random() * 900000 + 100000)}`;

    const user = await getUserById(db, ctx.from.id);
    if (!user) return ctx.reply('User tidak ditemukan. /start dulu.');

    const role = getEffectiveRole(ctx.from.id, user.role);
    const server = await listActiveServers(db).then((x) => x.find((s) => Number(s.id) === serverId));
    if (!server) return ctx.reply('Server tidak ditemukan.');

    if (server.is_reseller_only && !canAccessReseller(role)) {
      return ctx.reply('Server ini khusus reseller/admin.');
    }

    const price = Number(server.price || 0);
    const shouldChargeSaldo = role === 'member';
    if (price > 0 && shouldChargeSaldo) {
      const debit = await adjustSaldoWithLedger(db, {
        userId: ctx.from.id,
        amount: -price,
        type: 'purchase_account',
        referenceId: `create_${type}_${username}_${serverId}_${Date.now()}`,
        note: `Create ${type} ${username}`,
      });
      if (!debit.applied) {
        return ctx.reply(`Saldo tidak cukup. Harga: ${formatRupiah(price)}`);
      }
    }

    try {
      const result = await createPaidAccount(db, { type, username, password, days, serverId, quota: 0, limitip: 0 });
      const provider = result.provider || {};
      const expMs = Date.now() + days * 24 * 60 * 60 * 1000;
      await createAccountRecord(db, {
        userId: ctx.from.id,
        username: provider.username || username,
        type,
        serverId,
        createdAt: Date.now(),
        expiresAt: expMs,
        status: 'active',
      });

      return ctx.reply(
        [
          `<b>Account Created</b>`,
          `Type: <b>${type.toUpperCase()}</b>`,
          `Username: <code>${provider.username || username}</code>`,
          `Server: ${result.server.name}`,
          `Expired: ${provider.expired || provider.exp || '-'} ${provider.time || ''}`,
        ].join('\n'),
        { parse_mode: 'HTML' }
      );
    } catch (err) {
      return ctx.reply(`Gagal create: ${err.message}`);
    }
  });

  bot.command('trial', async (ctx) => {
    const parts = String(ctx.message.text || '').trim().split(/\s+/);
    if (parts.length < 3) return ctx.reply('Format: /trial [type] [server_id]');

    const type = String(parts[1] || '').toLowerCase();
    const serverId = Number(parts[2] || 0);

    try {
      const result = await createTrialAccount(db, { type, serverId });
      const provider = result.provider || {};
      await createAccountRecord(db, {
        userId: ctx.from.id,
        username: provider.username || `trial-${Date.now()}`,
        type,
        serverId,
        createdAt: Date.now(),
        expiresAt: Date.now() + 60 * 60 * 1000,
        status: 'active',
      });

      return ctx.reply(
        [
          `<b>Trial Created</b>`,
          `Type: <b>${type.toUpperCase()}</b>`,
          `Username: <code>${provider.username || '-'}</code>`,
          `Server: ${result.server.name}`,
        ].join('\n'),
        { parse_mode: 'HTML' }
      );
    } catch (err) {
      return ctx.reply(`Gagal trial: ${err.message}`);
    }
  });

  bot.command('renew', async (ctx) => {
    const parts = String(ctx.message.text || '').trim().split(/\s+/);
    if (parts.length < 5) return ctx.reply('Format: /renew [type] [username] [days] [server_id]');

    const type = String(parts[1] || '').toLowerCase();
    const username = parts[2];
    const days = Number(parts[3] || 0);
    const serverId = Number(parts[4] || 0);

    try {
      const result = await renewAccount(db, { type, username, days, serverId, quota: 0 });
      const acc = await getLatestAccountByUserTypeUsername(db, { userId: ctx.from.id, type, username });
      if (acc) {
        const base = Number(acc.expires_at || Date.now());
        const nextExp = base + days * 24 * 60 * 60 * 1000;
        await updateAccountExpiry(db, acc.id, nextExp);
      }
      return ctx.reply(`Renew sukses untuk ${username} di server ${result.server.name}.`);
    } catch (err) {
      return ctx.reply(`Gagal renew: ${err.message}`);
    }
  });

  bot.command('delete', async (ctx) => {
    const parts = String(ctx.message.text || '').trim().split(/\s+/);
    if (parts.length < 4) return ctx.reply('Format: /delete [type] [username] [server_id]');

    const type = String(parts[1] || '').toLowerCase();
    const username = parts[2];
    const serverId = Number(parts[3] || 0);

    try {
      await deleteAccountOnProvider(db, { type, username, serverId });
      const acc = await getLatestAccountByUserTypeUsername(db, { userId: ctx.from.id, type, username });
      if (acc) await markAccountDeleted(db, acc.id);
      return ctx.reply(`Akun ${username} berhasil dihapus.`);
    } catch (err) {
      return ctx.reply(`Gagal delete: ${err.message}`);
    }
  });

  bot.command('payok', async (ctx) => {
    const row = await getUserById(db, ctx.from.id);
    const actorRole = getEffectiveRole(ctx.from.id, row ? row.role : 'member');
    if (!canAccessAdmin(actorRole)) {
      return ctx.reply('Tidak punya akses.');
    }

    const parts = String(ctx.message.text || '').trim().split(/\s+/);
    if (parts.length < 2) {
      return ctx.reply('Format: /payok [invoice_id]');
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

  bot.command('cekqris', async (ctx) => {
    const parts = String(ctx.message.text || '').trim().split(/\s+/);
    if (parts.length < 2) return ctx.reply('Format: /cekqris [invoice_id]');

    const invoiceId = parts[1];
    const row = await getUserById(db, ctx.from.id);
    const role = getEffectiveRole(ctx.from.id, row ? row.role : 'member');
    const result = await checkInvoiceStatus(db, invoiceId);

    if (!result.ok) return ctx.reply(`Invoice tidak ditemukan: ${invoiceId}`);

    if (role === 'member' || role === 'reseller') {
      if (Number(result.row.user_id) !== Number(ctx.from.id)) {
        return ctx.reply('Kamu tidak punya akses untuk invoice ini.');
      }
    }

    return ctx.reply(
      [
        `<b>Status QRIS</b>`,
        `Invoice: <code>${invoiceId}</code>`,
        `Status: <b>${String(result.status || '-').toUpperCase()}</b>`,
        `Nominal: <b>${formatRupiah(result.row.amount)}</b>`,
        `Transfer: <b>${formatRupiah(result.row.total_amount)}</b>`,
      ].join('\n'),
      { parse_mode: 'HTML' }
    );
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
        `Provider Ref: <code>${invoice.providerRef || '-'}</code>`,
        `Expired: <b>${new Date(invoice.expiresAt).toLocaleString('id-ID')}</b>`,
        '',
        'Cek status pembayaran: /cekqris ' + invoice.invoiceId,
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
