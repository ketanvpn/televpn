const { getOne, getAll, run } = require('./sqliteRepo');

async function getServerPriceById(db, serverId) {
  return getOne(db, 'SELECT harga FROM Server WHERE id = ?', [serverId]);
}

async function getServerQuotaAndIpLimitById(db, serverId) {
  return getOne(db, 'SELECT quota, iplimit FROM Server WHERE id = ?', [serverId]);
}

async function getServerById(db, serverId) {
  return getOne(db, 'SELECT * FROM Server WHERE id = ?', [serverId]);
}

async function getServerCreateQuotaById(db, serverId) {
  return getOne(db, 'SELECT batas_create_akun, total_create_akun FROM Server WHERE id = ?', [serverId]);
}

async function listAllServers(db) {
  return getAll(db, 'SELECT * FROM Server');
}

async function listServerIdsAndNames(db) {
  return getAll(db, 'SELECT id, nama_server FROM Server');
}

async function listServersByResellerAccess(db, isReseller) {
  if (isReseller) {
    return getAll(db, 'SELECT * FROM Server');
  }
  return getAll(db, 'SELECT * FROM Server WHERE is_reseller_only = 0 OR is_reseller_only IS NULL');
}

async function deleteServerById(db, serverId) {
  return run(db, 'DELETE FROM Server WHERE id = ?', [serverId]);
}

async function deleteAllServers(db) {
  return run(db, 'DELETE FROM Server');
}

const SERVER_EDITABLE_FIELD_MAP = Object.freeze({
  nama_server: 'nama_server',
  domain: 'domain',
  auth: 'auth',
  quota: 'quota',
  iplimit: 'iplimit',
  batas_create_akun: 'batas_create_akun',
  total_create_akun: 'total_create_akun',
  harga: 'harga',
});

async function updateServerFieldById(db, serverId, fieldName, fieldValue) {
  const safeField = SERVER_EDITABLE_FIELD_MAP[fieldName];
  if (!safeField) {
    throw new Error(`Unsupported server field: ${fieldName}`);
  }
  return run(db, `UPDATE Server SET ${safeField} = ? WHERE id = ?`, [fieldValue, serverId]);
}

async function updateServerFieldByDomain(db, domain, fieldName, fieldValue) {
  const safeField = SERVER_EDITABLE_FIELD_MAP[fieldName];
  if (!safeField) {
    throw new Error(`Unsupported server field: ${fieldName}`);
  }
  return run(db, `UPDATE Server SET ${safeField} = ? WHERE domain = ?`, [fieldValue, domain]);
}

async function normalizeNullTotalCreateAkun(db) {
  return run(db, 'UPDATE Server SET total_create_akun = 0 WHERE total_create_akun IS NULL');
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
  getServerById,
  getServerCreateQuotaById,
  listAllServers,
  listServerIdsAndNames,
  listServersByResellerAccess,
  deleteServerById,
  deleteAllServers,
  updateServerFieldById,
  updateServerFieldByDomain,
  normalizeNullTotalCreateAkun,
  getServerPriceById,
  getServerQuotaAndIpLimitById,
  insertServer,
  insertResellerServer,
};
