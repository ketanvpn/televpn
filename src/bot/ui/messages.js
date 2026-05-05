function msgSuccess(text) {
  return `✅ <b>Berhasil</b>\n${text}`;
}

function msgError(text) {
  return `❌ <b>Gagal</b>\n${text}`;
}

function msgInfo(text) {
  return `ℹ️ <b>Info</b>\n${text}`;
}

module.exports = {
  msgSuccess,
  msgError,
  msgInfo,
};
