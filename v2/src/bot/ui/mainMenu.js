function formatRupiah(value) {
  return `Rp${Number(value || 0).toLocaleString('id-ID')}`;
}

function buildMainMenuText(payload) {
  const { userId, name, role, saldo } = payload;
  return [
    '<b>BOTVPN v2</b>',
    '',
    `<b>Nama</b>: ${name || '-'}`,
    `<b>ID</b>: <code>${userId}</code>`,
    `<b>Role</b>: ${role}`,
    `<b>Saldo</b>: ${formatRupiah(saldo)}`,
    '',
    '<i>Quick command: /servers, /create, /trial, /renew, /delete</i>',
    '',
    'Pilih menu di bawah:',
  ].join('\n');
}

function buildMainKeyboard(role) {
  const base = [
    [
      { text: 'Buat Akun', callback_data: 'menu:create' },
      { text: 'Akun Saya', callback_data: 'menu:accounts' },
    ],
    [
      { text: 'Topup QRIS', callback_data: 'menu:topup' },
      { text: 'Saldo', callback_data: 'menu:saldo' },
    ],
    [{ text: 'Bantuan', callback_data: 'menu:help' }],
  ];

  if (role === 'reseller' || role === 'admin' || role === 'master') {
    base.splice(2, 0, [{ text: 'Panel Reseller', callback_data: 'menu:reseller' }]);
  }

  if (role === 'admin' || role === 'master') {
    base.push([{ text: 'Panel Admin', callback_data: 'menu:admin' }]);
  }

  return { inline_keyboard: base };
}

module.exports = {
  buildMainMenuText,
  buildMainKeyboard,
  formatRupiah,
};
