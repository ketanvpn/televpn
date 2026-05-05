const axios = require('axios');
const { getServerById } = require('../repositories/serverRepository');

const CREATE_ENDPOINT = {
  ssh: '/vps/sshvpn',
  vmess: '/vps/vmessall',
  vless: '/vps/vlessall',
  trojan: '/vps/trojanall',
};

const TRIAL_ENDPOINT = {
  ssh: '/vps/trialsshvpn',
  vmess: '/vps/trialvmessall',
  vless: '/vps/trialvlessall',
  trojan: '/vps/trialtrojanall',
};

const RENEW_ENDPOINT = {
  ssh: '/vps/renewsshvpn',
  vmess: '/vps/renewvmess',
  vless: '/vps/renewvless',
  trojan: '/vps/renewtrojan',
};

const DELETE_ENDPOINT = {
  ssh: '/vps/deletesshvpn',
  vmess: '/vps/deletevmess',
  vless: '/vps/deletevless',
  trojan: '/vps/deletetrojan',
};

const LOCK_ENDPOINT = {
  ssh: '/vps/locksshvpn',
  vmess: '/vps/lockvmess',
  vless: '/vps/lockvless',
  trojan: '/vps/locktrojan',
};

const UNLOCK_ENDPOINT = {
  ssh: '/vps/unlocksshvpn',
  vmess: '/vps/unlockvmess',
  vless: '/vps/unlockvless',
  trojan: '/vps/unlocktrojan',
};

function isValidUsername(username) {
  return /^[a-zA-Z0-9]+$/.test(String(username || ''));
}

function getBaseUrl(domain) {
  const d = String(domain || '').trim();
  if (!d) throw new Error('Domain server kosong');
  return d.startsWith('http://') || d.startsWith('https://') ? d : `http://${d}`;
}

function getHeaders(authToken) {
  const token = String(authToken || '').trim();
  return {
    Authorization: token,
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
}

async function createPaidAccount(db, payload) {
  const { type, username, password, days, quota = 0, limitip = 0, serverId } = payload;
  if (!CREATE_ENDPOINT[type]) throw new Error('Tipe akun tidak didukung');
  if (!isValidUsername(username)) throw new Error('Username tidak valid (hanya huruf/angka)');

  const server = await getServerById(db, serverId);
  if (!server) throw new Error('Server tidak ditemukan');

  const body = {
    expired: Number(days || 0),
    kuota: String(quota || 0),
    limitip: String(limitip || 0),
    username: String(username),
  };
  if (type === 'ssh') {
    body.password = String(password || username);
  }

  const res = await axios.post(`${getBaseUrl(server.domain)}${CREATE_ENDPOINT[type]}`, body, {
    headers: getHeaders(server.auth),
    timeout: 20000,
  });

  const data = res.data;
  if (data?.meta?.code !== 200 || !data?.data) {
    throw new Error(data?.message || data?.meta?.message || 'Gagal membuat akun');
  }

  return { server, provider: data.data };
}

async function createTrialAccount(db, payload) {
  const { type, serverId } = payload;
  if (!TRIAL_ENDPOINT[type]) throw new Error('Tipe trial tidak didukung');
  const server = await getServerById(db, serverId);
  if (!server) throw new Error('Server tidak ditemukan');

  const res = await axios.post(
    `${getBaseUrl(server.domain)}${TRIAL_ENDPOINT[type]}`,
    { timelimit: '1h' },
    { headers: getHeaders(server.auth), timeout: 20000 }
  );

  const data = res.data;
  if (data?.meta?.code !== 200 || !data?.data) {
    throw new Error(data?.message || data?.meta?.message || 'Gagal membuat trial');
  }

  return { server, provider: data.data };
}

async function renewAccount(db, payload) {
  const { type, username, days, quota = 0, serverId } = payload;
  if (!RENEW_ENDPOINT[type]) throw new Error('Tipe renew tidak didukung');
  if (!isValidUsername(username)) throw new Error('Username tidak valid (hanya huruf/angka)');
  const server = await getServerById(db, serverId);
  if (!server) throw new Error('Server tidak ditemukan');

  const res = await axios.patch(
    `${getBaseUrl(server.domain)}${RENEW_ENDPOINT[type]}/${encodeURIComponent(username)}/${Number(days || 0)}`,
    { kuota: Number(quota || 0) },
    { headers: getHeaders(server.auth), timeout: 20000 }
  );

  const data = res.data;
  if (data?.meta?.code !== 200 || !data?.data) {
    throw new Error(data?.message || data?.meta?.message || 'Gagal renew akun');
  }

  return { server, provider: data.data };
}

async function deleteAccountOnProvider(db, payload) {
  const { type, username, serverId } = payload;
  if (!DELETE_ENDPOINT[type]) throw new Error('Tipe delete tidak didukung');
  if (!isValidUsername(username)) throw new Error('Username tidak valid (hanya huruf/angka)');
  const server = await getServerById(db, serverId);
  if (!server) throw new Error('Server tidak ditemukan');

  const res = await axios.delete(
    `${getBaseUrl(server.domain)}${DELETE_ENDPOINT[type]}/${encodeURIComponent(username)}`,
    { headers: getHeaders(server.auth), timeout: 20000 }
  );

  const data = res.data;
  if (data?.meta?.code !== 200 || !data?.data) {
    throw new Error(data?.message || data?.meta?.message || 'Gagal hapus akun');
  }

  return { server, provider: data.data };
}

async function lockAccountOnProvider(db, payload) {
  const { type, username, serverId } = payload;
  if (!LOCK_ENDPOINT[type]) throw new Error('Tipe lock tidak didukung');
  if (!isValidUsername(username)) throw new Error('Username tidak valid (hanya huruf/angka)');
  const server = await getServerById(db, serverId);
  if (!server) throw new Error('Server tidak ditemukan');

  const url =
    type === 'ssh'
      ? `${getBaseUrl(server.domain)}${LOCK_ENDPOINT[type]}/${encodeURIComponent(username)}`
      : `${getBaseUrl(server.domain)}${LOCK_ENDPOINT[type]}/${encodeURIComponent(username)}`;

  const res = await axios.patch(url, {}, { headers: getHeaders(server.auth), timeout: 20000 });
  const data = res.data;
  if (data?.meta?.code !== 200 || !data?.data) {
    throw new Error(data?.message || data?.meta?.message || 'Gagal lock akun');
  }
  return { server, provider: data.data };
}

async function unlockAccountOnProvider(db, payload) {
  const { type, username, serverId } = payload;
  if (!UNLOCK_ENDPOINT[type]) throw new Error('Tipe unlock tidak didukung');
  if (!isValidUsername(username)) throw new Error('Username tidak valid (hanya huruf/angka)');
  const server = await getServerById(db, serverId);
  if (!server) throw new Error('Server tidak ditemukan');

  const url =
    type === 'ssh'
      ? `${getBaseUrl(server.domain)}${UNLOCK_ENDPOINT[type]}/${encodeURIComponent(username)}/pw`
      : `${getBaseUrl(server.domain)}${UNLOCK_ENDPOINT[type]}/${encodeURIComponent(username)}`;

  const res = await axios.patch(url, {}, { headers: getHeaders(server.auth), timeout: 20000 });
  const data = res.data;
  if (data?.meta?.code !== 200 || !data?.data) {
    throw new Error(data?.message || data?.meta?.message || 'Gagal unlock akun');
  }
  return { server, provider: data.data };
}

module.exports = {
  createPaidAccount,
  createTrialAccount,
  renewAccount,
  deleteAccountOnProvider,
  lockAccountOnProvider,
  unlockAccountOnProvider,
};
