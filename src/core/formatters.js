function rupiah(value) {
  return `Rp${Number(value || 0).toLocaleString('id-ID')}`;
}

function formatDateTime(value, timeZone = 'Asia/Jayapura') {
  const date = value instanceof Date ? value : new Date(value || Date.now());
  return date.toLocaleString('id-ID', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

module.exports = {
  rupiah,
  formatDateTime,
};
