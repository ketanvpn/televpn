const { getUserById, setUserRole, listAllUserIds, listUserIdsByRole } = require('../../repositories/userRepository');
const { listPendingQrisPaymentsByUser } = require('../../repositories/qrisPaymentRepository');
const { listAccountsByUser, createAccountRecord, getLatestAccountByUserTypeUsername, updateAccountExpiry, markAccountDeleted, updateLatestAccountStatus } = require('../../repositories/accountRepository');
const { listActiveServers, createServer } = require('../../repositories/serverRepository');
const { logAdminAction, listRecentAdminLogs } = require('../../repositories/adminAuditRepository');
const { getSetting, setSetting } = require('../../repositories/settingsRepository');
const { createTopupInvoice, finalizeInvoiceAsPaid, checkInvoiceStatus } = require('../../services/qrisService');
const { getEffectiveRole, canAccessAdmin, canAccessReseller } = require('../../services/roleService');
const { createPaidAccount, createTrialAccount, renewAccount, deleteAccountOnProvider, lockAccountOnProvider, unlockAccountOnProvider } = require('../../services/provisioningService');
const { adjustSaldoWithLedger } = require('../../services/walletService');
const { sendBackupNow } = require('../../services/backupService');
const { sendDailyReport } = require('../../services/dailyReportService');
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

function quickFlowKeyboard() {
  return {
    inline_keyboard: [[{ text: 'Batal', callback_data: 'quick:cancel' }]],
  };
}

function isSupportedType(type) {
  return ['ssh', 'vmess', 'vless', 'trojan'].includes(String(type || '').toLowerCase());
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function msgSuccess(title, body = '') {
  return `✅ <b>${title}</b>${body ? `\n${body}` : ''}`;
}

function msgError(title, body = '') {
  return `❌ <b>${title}</b>${body ? `\n${body}` : ''}`;
}

function msgInfo(title, body = '') {
  return `ℹ️ <b>${title}</b>${body ? `\n${body}` : ''}`;
}

async function getAdminStats(db) {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const startTs = startOfDay.getTime();

  const [users, activeAccounts, pendingQris, omzetToday] = await Promise.all([
    db.get('SELECT COUNT(*) AS total FROM users'),
    db.get("SELECT COUNT(*) AS total FROM accounts WHERE status = 'active'"),
    db.get("SELECT COUNT(*) AS total FROM qris_payments WHERE status = 'pending'"),
    db.get(
      "SELECT COALESCE(SUM(amount), 0) AS total FROM transactions WHERE type IN ('qris_topup', 'manual_addsaldo') AND created_at >= ?",
      [startTs]
    ),
  ]);

  return {
    users: Number(users?.total || 0),
    activeAccounts: Number(activeAccounts?.total || 0),
    pendingQris: Number(pendingQris?.total || 0),
    omzetToday: Number(omzetToday?.total || 0),
  };
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
      '<b>Pusat Bantuan</b>',
      '',
      '1) Topup QRIS: buka menu Topup lalu kirim nominal.',
      '2) Cek status invoice: <code>/cekqris &lt;invoice_id&gt;</code>.',
      '3) Admin bisa konfirmasi manual fallback via <code>/payok &lt;invoice_id&gt;</code>.',
      '4) Cek profil: /me, cek saldo: /saldo.',
      '',
      'Tip: gunakan /menu kapan saja untuk kembali ke dashboard.',
    ].join('\n');
    return ctx.reply(text, {
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: [[{ text: 'Kembali', callback_data: 'menu:home' }]] },
    });
  });

  bot.action('menu:saldo', async (ctx) => {
    await ctx.answerCbQuery();
    const row = await getUserById(db, ctx.from.id);
    if (!row) return ctx.reply(msgError('User tidak ditemukan.'), { parse_mode: 'HTML' });
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

  bot.action('quick:cancel', async (ctx) => {
    await ctx.answerCbQuery('Dibatalkan');
    clearState(ctx.from.id);
    return renderMainMenu(ctx, db);
  });

  bot.action('quick:create', async (ctx) => {
    await ctx.answerCbQuery();
    setState(ctx.from.id, { step: 'quick_create_input' });
    return ctx.reply(
      [
        '<b>Quick Create</b>',
        'Format: <code>type username days server_id</code>',
        'Contoh: <code>vmess userbaru 30 1</code>',
      ].join('\n'),
      { parse_mode: 'HTML', reply_markup: quickFlowKeyboard() }
    );
  });

  bot.action('quick:trial', async (ctx) => {
    await ctx.answerCbQuery();
    setState(ctx.from.id, { step: 'quick_trial_input' });
    return ctx.reply(
      [
        '<b>Quick Trial</b>',
        'Format: <code>type server_id</code>',
        'Contoh: <code>ssh 1</code>',
      ].join('\n'),
      { parse_mode: 'HTML', reply_markup: quickFlowKeyboard() }
    );
  });

  bot.action('quick:renew', async (ctx) => {
    await ctx.answerCbQuery();
    setState(ctx.from.id, { step: 'quick_renew_input' });
    return ctx.reply(
      [
        '<b>Quick Renew</b>',
        'Format: <code>type username days server_id</code>',
        'Contoh: <code>vmess userbaru 30 1</code>',
      ].join('\n'),
      { parse_mode: 'HTML', reply_markup: quickFlowKeyboard() }
    );
  });

  bot.action('quick:delete', async (ctx) => {
    await ctx.answerCbQuery();
    setState(ctx.from.id, { step: 'quick_delete_input' });
    return ctx.reply(
      [
        '<b>Quick Delete</b>',
        'Format: <code>type username server_id</code>',
        'Contoh: <code>vmess userbaru 1</code>',
      ].join('\n'),
      { parse_mode: 'HTML', reply_markup: quickFlowKeyboard() }
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
      return ctx.reply(msgError('Akses reseller belum tersedia untuk akun ini.'), { parse_mode: 'HTML' });
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
      return ctx.reply(msgError('Menu ini hanya untuk admin.'), { parse_mode: 'HTML' });
    }

    const stats = await getAdminStats(db);

    const text = [
      '<b>Panel Admin</b>',
      '',
      '<b>Ringkasan Hari Ini</b>',
      `• Total user: <b>${stats.users}</b>`,
      `• Akun aktif: <b>${stats.activeAccounts}</b>`,
      `• Pending QRIS: <b>${stats.pendingQris}</b>`,
      `• Omzet masuk: <b>${formatRupiah(stats.omzetToday)}</b>`,
      '',
      'Command penting:',
      '• <code>/setrole &lt;user_id&gt; &lt;member|reseller&gt;</code>',
      '• <code>/addserver &lt;name&gt;|&lt;domain&gt;|&lt;auth&gt;|&lt;price&gt;|&lt;reseller_only 0/1&gt;</code>',
      '• <code>/servers</code> (lihat daftar server)',
      '• <code>/trial &lt;type&gt; &lt;server_id&gt;</code>',
      '• <code>/renew &lt;type&gt; &lt;username&gt; &lt;days&gt; &lt;server_id&gt;</code>',
      '• <code>/delete &lt;type&gt; &lt;username&gt; &lt;server_id&gt;</code>',
      '• <code>/lock &lt;type&gt; &lt;username&gt; &lt;server_id&gt;</code>',
      '• <code>/unlock &lt;type&gt; &lt;username&gt; &lt;server_id&gt;</code>',
      '• <code>/broadcastall &lt;pesan&gt;</code>',
      '• <code>/broadcastres &lt;pesan&gt;</code>',
      '• <code>/broadcastmem &lt;pesan&gt;</code>',
      '• <code>/payok &lt;invoice_id&gt;</code> (simulasi settlement)',
      '• <code>/cekqris &lt;invoice_id&gt;</code> (cek status invoice)',
      '• <code>/backupnow</code> kirim backup database sekarang',
      '• <code>/dailyreportnow</code> kirim laporan harian sekarang',
      '• <code>/adminlogs</code> lihat audit action admin',
      '• <code>/maintenance on|off</code> toggle mode maintenance',
      '• <code>/maintmsg show|reset|set ...</code> atur pesan maintenance',
      '• /menu kembali ke menu utama',
    ].join('\n');

    return ctx.reply(text, {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [
            { text: 'Quick Lock', callback_data: 'quick:lock' },
            { text: 'Quick Unlock', callback_data: 'quick:unlock' },
          ],
          [
            { text: 'BC All', callback_data: 'quick:broadcast_all' },
            { text: 'BC Res', callback_data: 'quick:broadcast_res' },
            { text: 'BC Mem', callback_data: 'quick:broadcast_mem' },
          ],
          [{ text: 'Refresh Stats', callback_data: 'menu:admin' }],
          [{ text: 'Kembali', callback_data: 'menu:home' }],
        ],
      },
    });
  });

  bot.action('quick:lock', async (ctx) => {
    await ctx.answerCbQuery();
    const row = await getUserById(db, ctx.from.id);
    const actorRole = getEffectiveRole(ctx.from.id, row ? row.role : 'member');
    if (!canAccessAdmin(actorRole)) return ctx.reply('Tidak punya akses.');
    setState(ctx.from.id, { step: 'quick_lock_input' });
    return ctx.reply('Quick Lock\nFormat: type username server_id\nContoh: vmess userbaru 1', {
      reply_markup: quickFlowKeyboard(),
    });
  });

  bot.action('quick:unlock', async (ctx) => {
    await ctx.answerCbQuery();
    const row = await getUserById(db, ctx.from.id);
    const actorRole = getEffectiveRole(ctx.from.id, row ? row.role : 'member');
    if (!canAccessAdmin(actorRole)) return ctx.reply('Tidak punya akses.');
    setState(ctx.from.id, { step: 'quick_unlock_input' });
    return ctx.reply('Quick Unlock\nFormat: type username server_id\nContoh: vmess userbaru 1', {
      reply_markup: quickFlowKeyboard(),
    });
  });

  bot.action('quick:broadcast_all', async (ctx) => {
    await ctx.answerCbQuery();
    const row = await getUserById(db, ctx.from.id);
    const actorRole = getEffectiveRole(ctx.from.id, row ? row.role : 'member');
    if (!canAccessAdmin(actorRole)) return ctx.reply('Tidak punya akses.');
    setState(ctx.from.id, { step: 'quick_broadcast_input', mode: 'all' });
    return ctx.reply('Kirim pesan broadcast untuk semua user.', { reply_markup: quickFlowKeyboard() });
  });

  bot.action('quick:broadcast_res', async (ctx) => {
    await ctx.answerCbQuery();
    const row = await getUserById(db, ctx.from.id);
    const actorRole = getEffectiveRole(ctx.from.id, row ? row.role : 'member');
    if (!canAccessAdmin(actorRole)) return ctx.reply('Tidak punya akses.');
    setState(ctx.from.id, { step: 'quick_broadcast_input', mode: 'reseller' });
    return ctx.reply('Kirim pesan broadcast untuk reseller.', { reply_markup: quickFlowKeyboard() });
  });

  bot.action('quick:broadcast_mem', async (ctx) => {
    await ctx.answerCbQuery();
    const row = await getUserById(db, ctx.from.id);
    const actorRole = getEffectiveRole(ctx.from.id, row ? row.role : 'member');
    if (!canAccessAdmin(actorRole)) return ctx.reply('Tidak punya akses.');
    setState(ctx.from.id, { step: 'quick_broadcast_input', mode: 'member' });
    return ctx.reply('Kirim pesan broadcast untuk member.', { reply_markup: quickFlowKeyboard() });
  });

  bot.command('adminstats', async (ctx) => {
    const row = await getUserById(db, ctx.from.id);
    const actorRole = getEffectiveRole(ctx.from.id, row ? row.role : 'member');
    if (!canAccessAdmin(actorRole)) return ctx.reply('Tidak punya akses.');

    const stats = await getAdminStats(db);
    return ctx.reply(
      [
        '<b>Admin Stats</b>',
        `Total user: <b>${stats.users}</b>`,
        `Akun aktif: <b>${stats.activeAccounts}</b>`,
        `Pending QRIS: <b>${stats.pendingQris}</b>`,
        `Omzet hari ini: <b>${formatRupiah(stats.omzetToday)}</b>`,
      ].join('\n'),
      { parse_mode: 'HTML' }
    );
  });

  bot.command('setrole', async (ctx) => {
    const row = await getUserById(db, ctx.from.id);
    const actorRole = getEffectiveRole(ctx.from.id, row ? row.role : 'member');
    if (!canAccessAdmin(actorRole)) return ctx.reply(msgError('Tidak punya akses.'), { parse_mode: 'HTML' });

    const parts = String(ctx.message.text || '').trim().split(/\s+/);
    if (parts.length !== 3) {
      return ctx.reply(msgInfo('Format command', '<code>/setrole [user_id] [member|reseller]</code>'), { parse_mode: 'HTML' });
    }

    const targetId = Number(parts[1]);
    const role = String(parts[2] || '').toLowerCase();
    if (!targetId || !['member', 'reseller'].includes(role)) {
      return ctx.reply(msgError('Parameter tidak valid.'));
    }

    const res = await setUserRole(db, targetId, role);
    if (!res.changes) return ctx.reply(msgError('User target tidak ditemukan.'), { parse_mode: 'HTML' });
    await logAdminAction(db, {
      adminUserId: ctx.from.id,
      action: 'setrole',
      targetUserId: targetId,
      detail: `role=${role}`,
    });
    return ctx.reply(msgSuccess('Role berhasil diubah', `User <code>${targetId}</code> sekarang <b>${role}</b>.`), { parse_mode: 'HTML' });
  });

  bot.command('addserver', async (ctx) => {
    const row = await getUserById(db, ctx.from.id);
    const actorRole = getEffectiveRole(ctx.from.id, row ? row.role : 'member');
    if (!canAccessAdmin(actorRole)) return ctx.reply(msgError('Tidak punya akses.'), { parse_mode: 'HTML' });

    const raw = String(ctx.message.text || '').replace(/^\/addserver\s*/i, '').trim();
    const parts = raw.split('|').map((x) => x.trim());
    if (parts.length < 5) {
      return ctx.reply(msgInfo('Format command', '<code>/addserver [name]|[domain]|[auth]|[price]|[reseller_only 0/1]</code>'), { parse_mode: 'HTML' });
    }

    const [name, domain, authToken, priceRaw, resellerOnlyRaw] = parts;
    const price = Number(priceRaw || 0);
    const isResellerOnly = String(resellerOnlyRaw) === '1';
    const res = await createServer(db, { name, domain, authToken, price, isResellerOnly });
    await logAdminAction(db, {
      adminUserId: ctx.from.id,
      action: 'addserver',
      targetRef: `server:${res.lastID}`,
      detail: `name=${name};domain=${domain};price=${price};reseller_only=${isResellerOnly ? 1 : 0}`,
    });
    return ctx.reply(msgSuccess('Server berhasil ditambahkan', `ID server: <code>${res.lastID}</code>`), { parse_mode: 'HTML' });
  });

  bot.command('servers', async (ctx) => {
    const list = await listActiveServers(db);
    if (!list.length) return ctx.reply(msgInfo('Belum ada server aktif.'), { parse_mode: 'HTML' });
    const lines = ['Daftar Server:'];
    list.forEach((s) => {
      lines.push(`#${s.id} | ${s.name} | ${s.domain || '-'} | harga ${formatRupiah(s.price)} | reseller_only=${s.is_reseller_only}`);
    });
    return ctx.reply(lines.join('\n'));
  });

  async function executeCreate(ctx, payload) {
    const { type, username, days, serverId } = payload;
    const password = `pw${Math.floor(Math.random() * 900000 + 100000)}`;

    const user = await getUserById(db, ctx.from.id);
    if (!user) return ctx.reply(msgError('User tidak ditemukan. Jalankan /start dulu.'), { parse_mode: 'HTML' });

    const role = getEffectiveRole(ctx.from.id, user.role);
    const server = await listActiveServers(db).then((x) => x.find((s) => Number(s.id) === Number(serverId)));
    if (!server) return ctx.reply(msgError('Server tidak ditemukan.'), { parse_mode: 'HTML' });

    if (server.is_reseller_only && !canAccessReseller(role)) {
      return ctx.reply(msgError('Server ini khusus reseller/admin.'), { parse_mode: 'HTML' });
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
        return ctx.reply(msgError('Saldo tidak cukup', `Harga akun: <b>${formatRupiah(price)}</b>`), { parse_mode: 'HTML' });
      }
    }

    try {
      const result = await createPaidAccount(db, { type, username, password, days, serverId, quota: 0, limitip: 0 });
      const provider = result.provider || {};
      const expMs = Date.now() + Number(days) * 24 * 60 * 60 * 1000;
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
          `✅ <b>Account Created</b>`,
          `Type: <b>${String(type).toUpperCase()}</b>`,
          `Username: <code>${provider.username || username}</code>`,
          `Server: ${result.server.name}`,
          `Expired: ${provider.expired || provider.exp || '-'} ${provider.time || ''}`,
        ].join('\n'),
        { parse_mode: 'HTML' }
      );
    } catch (err) {
      return ctx.reply(msgError('Gagal create akun', `<code>${String(err.message || err)}</code>`), { parse_mode: 'HTML' });
    }
  }

  async function executeTrial(ctx, payload) {
    const { type, serverId } = payload;
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
          `✅ <b>Trial Created</b>`,
          `Type: <b>${String(type).toUpperCase()}</b>`,
          `Username: <code>${provider.username || '-'}</code>`,
          `Server: ${result.server.name}`,
        ].join('\n'),
        { parse_mode: 'HTML' }
      );
    } catch (err) {
      return ctx.reply(msgError('Gagal membuat trial', `<code>${String(err.message || err)}</code>`), { parse_mode: 'HTML' });
    }
  }

  async function executeRenew(ctx, payload) {
    const { type, username, days, serverId } = payload;
    try {
      const result = await renewAccount(db, { type, username, days, serverId, quota: 0 });
      const acc = await getLatestAccountByUserTypeUsername(db, { userId: ctx.from.id, type, username });
      if (acc) {
        const base = Number(acc.expires_at || Date.now());
        const nextExp = base + Number(days) * 24 * 60 * 60 * 1000;
        await updateAccountExpiry(db, acc.id, nextExp);
      }
      return ctx.reply(msgSuccess('Renew berhasil', `Akun <code>${username}</code> di server <b>${result.server.name}</b> berhasil diperpanjang.`), { parse_mode: 'HTML' });
    } catch (err) {
      return ctx.reply(msgError('Gagal renew akun', `<code>${String(err.message || err)}</code>`), { parse_mode: 'HTML' });
    }
  }

  async function executeDelete(ctx, payload) {
    const { type, username, serverId } = payload;
    try {
      await deleteAccountOnProvider(db, { type, username, serverId });
      const acc = await getLatestAccountByUserTypeUsername(db, { userId: ctx.from.id, type, username });
      if (acc) await markAccountDeleted(db, acc.id);
      return ctx.reply(msgSuccess('Delete berhasil', `Akun <code>${username}</code> berhasil dihapus.`), { parse_mode: 'HTML' });
    } catch (err) {
      return ctx.reply(msgError('Gagal delete akun', `<code>${String(err.message || err)}</code>`), { parse_mode: 'HTML' });
    }
  }

  bot.command('create', async (ctx) => {
    const parts = String(ctx.message.text || '').trim().split(/\s+/);
    if (parts.length < 5) {
      return ctx.reply('Format: /create [type] [username] [days] [server_id]');
    }

    const type = String(parts[1] || '').toLowerCase();
    const username = parts[2];
    const days = Number(parts[3] || 0);
    const serverId = Number(parts[4] || 0);
    return executeCreate(ctx, { type, username, days, serverId });
  });

  bot.command('trial', async (ctx) => {
    const parts = String(ctx.message.text || '').trim().split(/\s+/);
    if (parts.length < 3) return ctx.reply('Format: /trial [type] [server_id]');

    const type = String(parts[1] || '').toLowerCase();
    const serverId = Number(parts[2] || 0);

    return executeTrial(ctx, { type, serverId });
  });

  bot.command('renew', async (ctx) => {
    const parts = String(ctx.message.text || '').trim().split(/\s+/);
    if (parts.length < 5) return ctx.reply('Format: /renew [type] [username] [days] [server_id]');

    const type = String(parts[1] || '').toLowerCase();
    const username = parts[2];
    const days = Number(parts[3] || 0);
    const serverId = Number(parts[4] || 0);

    return executeRenew(ctx, { type, username, days, serverId });
  });

  bot.command('delete', async (ctx) => {
    const parts = String(ctx.message.text || '').trim().split(/\s+/);
    if (parts.length < 4) return ctx.reply('Format: /delete [type] [username] [server_id]');

    const type = String(parts[1] || '').toLowerCase();
    const username = parts[2];
    const serverId = Number(parts[3] || 0);

    return executeDelete(ctx, { type, username, serverId });
  });

  bot.command('lock', async (ctx) => {
    const parts = String(ctx.message.text || '').trim().split(/\s+/);
    if (parts.length < 4) return ctx.reply('Format: /lock [type] [username] [server_id]');

    const type = String(parts[1] || '').toLowerCase();
    const username = parts[2];
    const serverId = Number(parts[3] || 0);
    try {
      await lockAccountOnProvider(db, { type, username, serverId });
      await updateLatestAccountStatus(db, { userId: ctx.from.id, type, username, status: 'locked' });
      return ctx.reply(`Akun ${username} berhasil dikunci.`);
    } catch (err) {
      return ctx.reply(`Gagal lock: ${err.message}`);
    }
  });

  bot.command('unlock', async (ctx) => {
    const parts = String(ctx.message.text || '').trim().split(/\s+/);
    if (parts.length < 4) return ctx.reply('Format: /unlock [type] [username] [server_id]');

    const type = String(parts[1] || '').toLowerCase();
    const username = parts[2];
    const serverId = Number(parts[3] || 0);
    try {
      await unlockAccountOnProvider(db, { type, username, serverId });
      await updateLatestAccountStatus(db, { userId: ctx.from.id, type, username, status: 'active' });
      return ctx.reply(`Akun ${username} berhasil dibuka.`);
    } catch (err) {
      return ctx.reply(`Gagal unlock: ${err.message}`);
    }
  });

  async function doBroadcast(ctx, mode) {
    const row = await getUserById(db, ctx.from.id);
    const actorRole = getEffectiveRole(ctx.from.id, row ? row.role : 'member');
    if (!canAccessAdmin(actorRole)) return ctx.reply('Tidak punya akses.');

    const message = String(ctx.message.text || '').replace(/^\/\w+\s*/i, '').trim();
    return doBroadcastMessage(ctx, mode, message);
  }

  async function doBroadcastMessage(ctx, mode, message) {
    if (!message) return ctx.reply('Pesan kosong. Contoh: /broadcastall Promo malam ini');

    let targets = [];
    if (mode === 'all') targets = await listAllUserIds(db);
    if (mode === 'reseller') targets = await listUserIdsByRole(db, 'reseller');
    if (mode === 'member') targets = await listUserIdsByRole(db, 'member');

    if (!targets.length) return ctx.reply('Target user kosong.');

    let ok = 0;
    let fail = 0;
    await ctx.reply(`Broadcast dimulai ke ${targets.length} user...`);

    for (const uid of targets) {
      try {
        await ctx.telegram.sendMessage(uid, message);
        ok += 1;
      } catch (_) {
        fail += 1;
      }
      await sleep(80);
    }

    await logAdminAction(db, {
      adminUserId: ctx.from.id,
      action: `broadcast_${mode}`,
      detail: `target=${targets.length};ok=${ok};fail=${fail}`,
    });

    return ctx.reply(`Broadcast selesai. Target=${targets.length}, berhasil=${ok}, gagal=${fail}.`);
  }

  bot.command('broadcastall', async (ctx) => doBroadcast(ctx, 'all'));
  bot.command('broadcastres', async (ctx) => doBroadcast(ctx, 'reseller'));
  bot.command('broadcastmem', async (ctx) => doBroadcast(ctx, 'member'));

  bot.command('backupnow', async (ctx) => {
    const row = await getUserById(db, ctx.from.id);
    const actorRole = getEffectiveRole(ctx.from.id, row ? row.role : 'member');
    if (!canAccessAdmin(actorRole)) return ctx.reply('Tidak punya akses.');

    await ctx.reply('Menjalankan backup sekarang...');
    await sendBackupNow(bot, `manual by ${ctx.from.id}`);
    await logAdminAction(db, {
      adminUserId: ctx.from.id,
      action: 'backupnow',
      detail: 'manual backup triggered',
    });
    return ctx.reply('Backup selesai dikirim (cek chat backup).');
  });

  bot.command('dailyreportnow', async (ctx) => {
    const row = await getUserById(db, ctx.from.id);
    const actorRole = getEffectiveRole(ctx.from.id, row ? row.role : 'member');
    if (!canAccessAdmin(actorRole)) return ctx.reply('Tidak punya akses.');

    await sendDailyReport(bot, db, 'manual');
    await logAdminAction(db, {
      adminUserId: ctx.from.id,
      action: 'dailyreportnow',
      detail: 'manual daily report triggered',
    });
    return ctx.reply('Laporan harian terkirim.');
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

    await logAdminAction(db, {
      adminUserId: ctx.from.id,
      action: 'payok',
      targetUserId: result.userId,
      targetRef: invoiceId,
      detail: `amount=${result.amount}`,
    });

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

  bot.command('adminlogs', async (ctx) => {
    const row = await getUserById(db, ctx.from.id);
    const actorRole = getEffectiveRole(ctx.from.id, row ? row.role : 'member');
    if (!canAccessAdmin(actorRole)) return ctx.reply('Tidak punya akses.');

    const logs = await listRecentAdminLogs(db, 20);
    if (!logs.length) return ctx.reply('Belum ada log admin.');

    const lines = ['<b>Admin Audit Logs (20 terbaru)</b>', ''];
    logs.forEach((item, idx) => {
      const t = new Date(Number(item.created_at || 0)).toLocaleString('id-ID');
      lines.push(
        `${idx + 1}. <b>${item.action}</b> | admin=<code>${item.admin_user_id}</code> | target=${item.target_user_id || '-'} | ref=${item.target_ref || '-'} | ${t}`
      );
    });

    return ctx.reply(lines.join('\n'), { parse_mode: 'HTML' });
  });

  bot.command('maintenance', async (ctx) => {
    const row = await getUserById(db, ctx.from.id);
    const actorRole = getEffectiveRole(ctx.from.id, row ? row.role : 'member');
    if (!canAccessAdmin(actorRole)) return ctx.reply('Tidak punya akses.');

    const parts = String(ctx.message.text || '').trim().split(/\s+/);
    if (parts.length < 2) {
      const current = await getSetting(db, 'maintenance_enabled');
      const nowMode = String(current || 'false').toLowerCase() === 'true' ? 'ON' : 'OFF';
      return ctx.reply(`Mode maintenance saat ini: ${nowMode}\nFormat: /maintenance on atau /maintenance off`);
    }

    const mode = String(parts[1] || '').toLowerCase();
    if (!['on', 'off'].includes(mode)) {
      return ctx.reply('Mode tidak valid. Pakai: /maintenance on atau /maintenance off');
    }

    const enabled = mode === 'on';
    await setSetting(db, 'maintenance_enabled', enabled ? 'true' : 'false');
    await logAdminAction(db, {
      adminUserId: ctx.from.id,
      action: 'maintenance_toggle',
      detail: `enabled=${enabled}`,
    });

    return ctx.reply(enabled ? '✅ Maintenance ON' : '✅ Maintenance OFF');
  });

  bot.command('maintmsg', async (ctx) => {
    const row = await getUserById(db, ctx.from.id);
    const actorRole = getEffectiveRole(ctx.from.id, row ? row.role : 'member');
    if (!canAccessAdmin(actorRole)) return ctx.reply('Tidak punya akses.');

    const raw = String(ctx.message.text || '').replace(/^\/maintmsg\s*/i, '').trim();
    if (!raw) {
      return ctx.reply('Format:\n/maintmsg show\n/maintmsg reset\n/maintmsg set <pesan>');
    }

    const parts = raw.split(/\s+/);
    const mode = String(parts[0] || '').toLowerCase();

    if (mode === 'show') {
      const current = await getSetting(db, 'maintenance_message');
      const text = String(current || '').trim() || '⚠️ Bot sedang maintenance. Silakan coba lagi beberapa saat.';
      return ctx.reply(`Pesan maintenance saat ini:\n${text}`);
    }

    if (mode === 'reset') {
      await setSetting(db, 'maintenance_message', '');
      await logAdminAction(db, {
        adminUserId: ctx.from.id,
        action: 'maintenance_message_reset',
      });
      return ctx.reply('✅ Pesan maintenance direset ke default.');
    }

    if (mode === 'set') {
      const message = raw.replace(/^set\s*/i, '').trim();
      if (!message) return ctx.reply('Pesan kosong. Contoh: /maintmsg set Sedang maintenance sampai 22:30');
      if (message.length > 500) return ctx.reply('Pesan terlalu panjang. Maksimal 500 karakter.');

      await setSetting(db, 'maintenance_message', message);
      await logAdminAction(db, {
        adminUserId: ctx.from.id,
        action: 'maintenance_message_set',
        detail: `length=${message.length}`,
      });
      return ctx.reply('✅ Pesan maintenance berhasil diperbarui.');
    }

    return ctx.reply('Mode tidak valid. Gunakan: show, reset, atau set');
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

    if (current.step === 'quick_create_input') {
      const parts = String(ctx.message.text || '').trim().split(/\s+/);
      if (parts.length < 4) {
        return ctx.reply('Format salah. Contoh: vmess userbaru 30 1', { reply_markup: quickFlowKeyboard() });
      }

      const [typeRaw, username, daysRaw, serverRaw] = parts;
      const type = String(typeRaw || '').toLowerCase();
      const days = Number(daysRaw || 0);
      const serverId = Number(serverRaw || 0);

      if (!isSupportedType(type) || !username || days <= 0 || !serverId) {
        return ctx.reply('Parameter tidak valid. Type: ssh/vmess/vless/trojan.', { reply_markup: quickFlowKeyboard() });
      }

      clearState(ctx.from.id);
      return executeCreate(ctx, { type, username, days, serverId });
    }

    if (current.step === 'quick_trial_input') {
      const parts = String(ctx.message.text || '').trim().split(/\s+/);
      if (parts.length < 2) {
        return ctx.reply('Format salah. Contoh: ssh 1', { reply_markup: quickFlowKeyboard() });
      }

      const [typeRaw, serverRaw] = parts;
      const type = String(typeRaw || '').toLowerCase();
      const serverId = Number(serverRaw || 0);
      if (!isSupportedType(type) || !serverId) {
        return ctx.reply('Parameter tidak valid. Type: ssh/vmess/vless/trojan.', { reply_markup: quickFlowKeyboard() });
      }

      clearState(ctx.from.id);
      return executeTrial(ctx, { type, serverId });
    }

    if (current.step === 'quick_renew_input') {
      const parts = String(ctx.message.text || '').trim().split(/\s+/);
      if (parts.length < 4) {
        return ctx.reply('Format salah. Contoh: vmess userbaru 30 1', { reply_markup: quickFlowKeyboard() });
      }

      const [typeRaw, username, daysRaw, serverRaw] = parts;
      const type = String(typeRaw || '').toLowerCase();
      const days = Number(daysRaw || 0);
      const serverId = Number(serverRaw || 0);
      if (!isSupportedType(type) || !username || days <= 0 || !serverId) {
        return ctx.reply('Parameter tidak valid. Type: ssh/vmess/vless/trojan.', { reply_markup: quickFlowKeyboard() });
      }

      clearState(ctx.from.id);
      return executeRenew(ctx, { type, username, days, serverId });
    }

    if (current.step === 'quick_delete_input') {
      const parts = String(ctx.message.text || '').trim().split(/\s+/);
      if (parts.length < 3) {
        return ctx.reply('Format salah. Contoh: vmess userbaru 1', { reply_markup: quickFlowKeyboard() });
      }

      const [typeRaw, username, serverRaw] = parts;
      const type = String(typeRaw || '').toLowerCase();
      const serverId = Number(serverRaw || 0);
      if (!isSupportedType(type) || !username || !serverId) {
        return ctx.reply('Parameter tidak valid. Type: ssh/vmess/vless/trojan.', { reply_markup: quickFlowKeyboard() });
      }

      clearState(ctx.from.id);
      return executeDelete(ctx, { type, username, serverId });
    }

    if (current.step === 'quick_lock_input') {
      const parts = String(ctx.message.text || '').trim().split(/\s+/);
      if (parts.length < 3) {
        return ctx.reply('Format salah. Contoh: vmess userbaru 1', { reply_markup: quickFlowKeyboard() });
      }
      const [typeRaw, username, serverRaw] = parts;
      const type = String(typeRaw || '').toLowerCase();
      const serverId = Number(serverRaw || 0);
      if (!isSupportedType(type) || !username || !serverId) {
        return ctx.reply('Parameter tidak valid. Type: ssh/vmess/vless/trojan.', { reply_markup: quickFlowKeyboard() });
      }
      clearState(ctx.from.id);
      try {
        await lockAccountOnProvider(db, { type, username, serverId });
        await updateLatestAccountStatus(db, { userId: ctx.from.id, type, username, status: 'locked' });
        return ctx.reply(`Akun ${username} berhasil dikunci.`);
      } catch (err) {
        return ctx.reply(`Gagal lock: ${err.message}`);
      }
    }

    if (current.step === 'quick_unlock_input') {
      const parts = String(ctx.message.text || '').trim().split(/\s+/);
      if (parts.length < 3) {
        return ctx.reply('Format salah. Contoh: vmess userbaru 1', { reply_markup: quickFlowKeyboard() });
      }
      const [typeRaw, username, serverRaw] = parts;
      const type = String(typeRaw || '').toLowerCase();
      const serverId = Number(serverRaw || 0);
      if (!isSupportedType(type) || !username || !serverId) {
        return ctx.reply('Parameter tidak valid. Type: ssh/vmess/vless/trojan.', { reply_markup: quickFlowKeyboard() });
      }
      clearState(ctx.from.id);
      try {
        await unlockAccountOnProvider(db, { type, username, serverId });
        await updateLatestAccountStatus(db, { userId: ctx.from.id, type, username, status: 'active' });
        return ctx.reply(`Akun ${username} berhasil dibuka.`);
      } catch (err) {
        return ctx.reply(`Gagal unlock: ${err.message}`);
      }
    }

    if (current.step === 'quick_broadcast_input') {
      const mode = current.mode || 'all';
      const message = String(ctx.message.text || '').trim();
      clearState(ctx.from.id);
      return doBroadcastMessage(ctx, mode, message);
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
