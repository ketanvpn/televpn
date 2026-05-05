const { config } = require('../core/config');

function getEffectiveRole(userId, dbRole) {
  const id = Number(userId || 0);
  if (id && id === config.masterId) return 'master';
  if (id && config.adminIds.includes(id)) return 'admin';
  return dbRole || 'member';
}

function canAccessAdmin(role) {
  return role === 'master' || role === 'admin';
}

function canAccessReseller(role) {
  return role === 'master' || role === 'admin' || role === 'reseller';
}

module.exports = {
  getEffectiveRole,
  canAccessAdmin,
  canAccessReseller,
};
