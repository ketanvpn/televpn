const fs = require('fs');
const { VARS_PATH } = require('./paths');
const { logger } = require('./logger');

function loadVars() {
  try {
    return JSON.parse(fs.readFileSync(VARS_PATH, 'utf8'));
  } catch (e) {
    logger.error('Gagal membaca .vars.json. Pastikan file ada & format JSON benar:', e.message || e);
    return {};
  }
}

function readVarsFresh(fallback = {}) {
  try {
    const raw = fs.readFileSync(VARS_PATH, 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    logger.error('Gagal membaca .vars.json terbaru:', e.message || e);
    return fallback || {};
  }
}

function writeVarsPartial(partial, fallback = {}) {
  const current = readVarsFresh(fallback);
  const updated = { ...current, ...partial };
  fs.writeFileSync(VARS_PATH, JSON.stringify(updated, null, 2));
  return updated;
}

function maskToken(token, head = 12, tail = 8) {
  const value = String(token || '').trim();
  if (!value) return '-';
  if (value.length <= head + tail) return value;
  return `${value.slice(0, head)}...${value.slice(-tail)}`;
}

module.exports = {
  loadVars,
  readVarsFresh,
  writeVarsPartial,
  maskToken,
};
