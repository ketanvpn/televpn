async function incrementServerCreateCount(db, logger, serverId) {
  return new Promise((resolve) => {
    db.run('UPDATE Server SET total_create_akun = total_create_akun + 1 WHERE id = ?', [serverId], (err) => {
      if (err) {
        logger.error('⚠️ Kesalahan saat menambahkan total_create_akun:', err.message);
      }
      resolve();
    });
  });
}

module.exports = { incrementServerCreateCount };
