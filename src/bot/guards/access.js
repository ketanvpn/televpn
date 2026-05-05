const NO_ACCESS_MESSAGE = '🚫 Kamu tidak punya akses untuk perintah ini.';
const MASTER_ONLY_MESSAGE =
  '⚠️ <b>Perintah ini hanya bisa digunakan oleh pemilik bot (MASTER).</b>';

function parseAdminIds(rawAdminIds) {
  if (Array.isArray(rawAdminIds)) {
    return rawAdminIds
      .map((id) => Number(id))
      .filter((id) => !Number.isNaN(id));
  }

  return String(rawAdminIds)
    .split(',')
    .map((id) => Number(id.trim()))
    .filter((id) => !Number.isNaN(id));
}

function isMaster(userId, masterId) {
  return Number(userId) === Number(masterId);
}

function isAdmin(userId, adminIds) {
  return adminIds.includes(Number(userId));
}

function isAdminOrMaster(userId, adminIds, masterId) {
  return isAdmin(userId, adminIds) || isMaster(userId, masterId);
}

module.exports = {
  NO_ACCESS_MESSAGE,
  MASTER_ONLY_MESSAGE,
  parseAdminIds,
  isMaster,
  isAdmin,
  isAdminOrMaster,
};
