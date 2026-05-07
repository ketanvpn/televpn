function buildStaticQrisImageUrl(qrString) {
  const payload = String(qrString || '').trim();
  if (!payload) return '';
  return `https://api.qrserver.com/v1/create-qr-code/?size=512x512&data=${encodeURIComponent(payload)}`;
}

function buildEmvTag(tag, value) {
  const v = String(value ?? '');
  return `${tag}${String(v.length).padStart(2, '0')}${v}`;
}

function crc16Ccitt(payload) {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i += 1) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j += 1) {
      if ((crc & 0x8000) !== 0) {
        crc = ((crc << 1) ^ 0x1021) & 0xffff;
      } else {
        crc = (crc << 1) & 0xffff;
      }
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

function removeTag54(payload) {
  const idx = payload.indexOf('54');
  if (idx === -1) return payload;
  const len = Number.parseInt(payload.slice(idx + 2, idx + 4), 10);
  if (!Number.isFinite(len) || len < 0) return payload;
  return payload.slice(0, idx) + payload.slice(idx + 4 + len);
}

function buildDynamicQrisPayload(baseQrString, amount) {
  const nominal = Number(amount || 0);
  if (!Number.isFinite(nominal) || nominal <= 0) {
    throw new Error('Nominal QRIS dinamis tidak valid');
  }

  let payload = String(baseQrString || '').trim();
  if (!payload) {
    throw new Error('Base QRIS kosong');
  }

  const crcPos = payload.lastIndexOf('6304');
  if (crcPos >= 0) {
    payload = payload.slice(0, crcPos);
  }

  if (payload.includes('010211')) {
    payload = payload.replace('010211', '010212');
  } else if (!payload.includes('010212') && payload.startsWith('00020101')) {
    payload = payload.replace('00020101', '000201010212');
  }

  payload = removeTag54(payload);

  const amountTag = buildEmvTag('54', String(Math.round(nominal)));
  if (payload.includes('5802ID')) {
    payload = payload.replace('5802ID', `${amountTag}5802ID`);
  } else {
    payload += amountTag;
  }

  const unsignedPayload = `${payload}6304`;
  return `${unsignedPayload}${crc16Ccitt(unsignedPayload)}`;
}

module.exports = {
  buildStaticQrisImageUrl,
  buildDynamicQrisPayload,
};
