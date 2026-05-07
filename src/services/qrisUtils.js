function parseProviderTransactionTime(value) {
  if (value === null || typeof value === 'undefined' || value === '') return null;
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value > 1e12 ? value : value * 1000;
  }

  const raw = String(value).trim();
  if (!raw) return null;

  const directTs = Number(raw);
  if (Number.isFinite(directTs) && directTs > 0) {
    return directTs > 1e12 ? directTs : directTs * 1000;
  }

  const normalized = raw.includes('T') ? raw : raw.replace(' ', 'T');
  const parsed = Date.parse(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function buildProviderTransactionFingerprint(trx) {
  if (!trx || typeof trx !== 'object') return '';
  const explicitId = String(trx.id || trx.transaction_id || trx.tx_id || '').trim();
  if (explicitId) return `id:${explicitId}`;

  const amount = Number(trx.amount || 0);
  const timeMs =
    parseProviderTransactionTime(
      trx.time || trx.created_at || trx.updated_at || trx.transaction_time
    ) || 0;
  const issuer = String(trx.issuer || '').trim().toLowerCase();
  const paymentType = String(trx.payment_type || '').trim().toLowerCase();
  const status = String(trx.status || '').trim().toLowerCase();
  return `fp:${amount}|${timeMs}|${issuer}|${paymentType}|${status}`;
}

function findMatchingSettlementTransaction(transactions, expectedAmount, options = {}) {
  const expected = Number(expectedAmount || 0);
  if (!Array.isArray(transactions) || expected <= 0) return null;

  const createdAtMs = Number(options.createdAt || 0);
  const timeWindowMs = Number(options.timeWindowMs || 0);
  const hasTimeWindow = createdAtMs > 0 && timeWindowMs > 0;
  const minTs = hasTimeWindow ? createdAtMs : 0;
  const maxTs = hasTimeWindow ? createdAtMs + timeWindowMs : 0;

  const candidates = transactions.filter((trx) => {
    const amount = Number(trx?.amount || 0);
    const status = String(trx?.status || '').toLowerCase();
    return amount === expected && status === 'settlement';
  });

  if (candidates.length === 0) return null;
  if (!hasTimeWindow) return candidates[0] || null;

  const inWindow = candidates.filter((trx) => {
    const trxTime = parseProviderTransactionTime(
      trx?.time || trx?.created_at || trx?.updated_at || trx?.transaction_time
    );
    if (!trxTime) return false;
    return trxTime >= minTs && trxTime <= maxTs;
  });

  if (inWindow.length > 0) return inWindow[0];

  const missingTimestamp = candidates.filter((trx) => {
    const trxTime = parseProviderTransactionTime(
      trx?.time || trx?.created_at || trx?.updated_at || trx?.transaction_time
    );
    return !trxTime;
  });
  if (missingTimestamp.length === 1 && candidates.length === 1) {
    return candidates[0];
  }

  return null;
}

module.exports = {
  parseProviderTransactionTime,
  buildProviderTransactionFingerprint,
  findMatchingSettlementTransaction,
};
