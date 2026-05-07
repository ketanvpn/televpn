const { getOne, run } = require('./sqliteRepo');

async function getServerPriceById(db, serverId) {
  return getOne(db, 'SELECT harga FROM Server WHERE id = ?', [serverId]);
}

async function getServerQuotaAndIpLimitById(db, serverId) {
  return getOne(db, 'SELECT quota, iplimit FROM Server WHERE id = ?', [serverId]);
}

async function insertServer(db, payload) {
  const { domain, auth, nama_server, quota, iplimit, batas_create_akun, harga } = payload;
  return run(
    db,
    'INSERT INTO Server (domain, auth, nama_server, quota, iplimit, batas_create_akun, harga, total_create_akun) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [domain, auth, nama_server, quota, iplimit, batas_create_akun, harga, 0]
  );
}

async function insertResellerServer(db, payload) {
  const { domain, auth, harga, nama_server, quota, iplimit, batas_create_akun } = payload;
  return run(
    db,
    'INSERT INTO Server (domain, auth, harga, nama_server, quota, iplimit, batas_create_akun, total_create_akun, is_reseller_only) VALUES (?, ?, ?, ?, ?, ?, ?, 0, 1)',
    [domain, auth, harga, nama_server, quota, iplimit, batas_create_akun]
  );
}

module.exports = {
  getServerPriceById,
  getServerQuotaAndIpLimitById,
  insertServer,
  insertResellerServer,
};
