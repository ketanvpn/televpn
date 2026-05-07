function registerUserMenuHandlers(bot, deps) {
  const {
    logger,
    userState,
    isAdmin,
    adminIds,
    sendCleanMenu,
    toastError,
    sendMainMenu,
    NAMA_STORE,
    ADMIN_USERNAME,
  } = deps;

  bot.action('jadi_reseller', async (ctx) => {
    await ctx.answerCbQuery().catch(() => {});

    const userId = ctx.from.id;
    const storeName = NAMA_STORE || 'Layanan VPN';
    const adminName = ADMIN_USERNAME || 'Admin';

    const msg = `
<b>🤝 Program Reseller ${storeName}</b>

Pengen jualan akun VPN sendiri dengan modal lebih hemat?
Kamu bisa daftar sebagai <b>reseller resmi</b> di ${storeName}.

<b>✨ Keuntungan jadi reseller:</b>
• 💸 Dapat harga akun lebih murah dari harga user biasa.
• 🧾 Bebas atur harga jual ke pelanggan kamu sendiri.
• 🌐 Prioritas akses server & bantuan kalau ada kendala teknis.
• 🛟 Support langsung dari admin ${adminName} lewat chat.

<b>📌 Cara daftar reseller:</b>
1. Salin format pesan di bawah ini.
2. Kirim ke ${adminName} lewat chat Telegram.

<code>
Mau jadi reseller.
ID Telegram : ${userId}
Nama        : ....
</code>

<b>ℹ️ Keterangan tambahan:</b>
• Minimal deposit, list harga reseller, dan aturan lengkap akan dijelaskan oleh admin.
• Saldo reseller nantinya bisa dipakai untuk membuat akun VPN langsung dari bot.
• Disarankan pakai nomor & akun Telegram yang aktif agar mudah dihubungi.
`.trim();

    await sendCleanMenu(ctx, msg, { parse_mode: 'HTML' });
  });

  bot.action('help_user', async (ctx) => {
    await ctx.answerCbQuery().catch(() => {});

    const storeName = NAMA_STORE || 'Layanan VPN';
    const adminName = ADMIN_USERNAME || 'Admin';

    const text = `
<b>Bantuan Pengguna ${storeName}</b>

<b>1. Cara beli akun VPN</b>
• Tekan tombol "<b>➕ Buat Akun</b>" di menu utama.
• Pilih jenis akun (VMess / VLess / Trojan / SSH / lain-lain).
• Pilih server dan durasi paket.
• Konfirmasi pembelian sesuai petunjuk di layar.

<b>2. Cara cek akun & masa aktif</b>
• Tekan tombol "<b>📂 Akun Saya</b>".
• Bot akan menampilkan daftar akun milik kamu.
• Status akun:
  • ✅ Aktif (~X hari lagi)
  • ⚠️ Aktif (habis HARI INI)
  • ❌ Sudah expired

<b>3. Cara melihat riwayat akun</b>
• Tekan tombol "<b>📊 Riwayat Saya</b>".
• Di sana ada ringkasan:
  • Total akun yang pernah dibuat.
  • Berapa yang masih aktif.
  • Berapa yang sudah expired.
• Riwayat bisa digeser dengan tombol ⬅️ dan ➡️ di bawah pesan.

<b>4. Trial akun</b>
• Tekan tombol "<b>⌛ Trial Akun</b>" (jika tersedia).
• Trial hanya bisa dipakai <b>1x per hari</b> per akun Telegram (non-reseller).
• Jika sudah pernah trial hari ini, bot akan memberi info bahwa trial belum bisa dipakai lagi.

<b>5. TopUp saldo manual (QRIS)</b>
• Tekan tombol "<b>💰 TopUp Saldo Manual via (QRIS)</b>" di menu utama.
• Scan QRIS dengan aplikasi pembayaran kamu.
• Ikuti petunjuk jumlah & kirim bukti pembayaran ke admin sesuai format yang muncul.
• Setelah pembayaran dicek dan valid, saldo kamu akan diisi oleh admin.
• Saldo ini bisa dipakai untuk beli akun langsung dari bot, tanpa perlu chat admin satu-satu.

<b>6. Program Reseller (harga lebih murah)</b>
• Kalau kamu mau jualan akun VPN sendiri, atau ingin harga akun lebih murah dari harga user biasa:
  • Tekan tombol "<b>🤝 Jadi Reseller harga lebih murah!!</b>" di menu utama.
  • Di sana ada format pesan yang bisa kamu salin dan kirim ke admin.
• Setelah disetujui dan diaktifkan sebagai reseller:
  • Kamu akan dapat harga akun lebih murah.
  • Kamu bisa jual lagi ke pelangganmu dengan harga sendiri.
  • Saldo yang kamu isi bisa dipakai untuk membuat akun lewat bot.

<b>7. Butuh bantuan / komplain?</b>
Kalau kamu mengalami kendala:
• Akun tidak bisa konek.
• Config error / tidak bisa di-import.
• Salah pilih paket / server, dll.

Silakan hubungi admin <b>${adminName}</b> melalui Telegram.
Saat menghubungi admin, sertakan:
• Username akun VPN.
• Jenis akun (VMess / VLess / Trojan / SSH).
• Server yang dipakai.
• Kendala yang kamu alami (sedetail mungkin).

<b>8. Peraturan singkat pemakaian VPN</b>
• Dilarang membagikan akun, 1 akun 1 perangkat, kecuali server yang ada keterangan [2 device].
• Dilarang menggunakan VPN untuk aktivitas yang melanggar hukum.
• Admin berhak memutus/mematikan akun yang melanggar ketentuan.

Terima kasih sudah memakai layanan ${storeName}.
Jika masih bingung, kamu selalu bisa tekan tombol ini lagi: "<b>❓ Bantuan</b>".
  `.trim();

    try {
      await sendCleanMenu(ctx, text, { parse_mode: 'HTML' });
    } catch (e) {
      logger.error('Gagal kirim pesan bantuan:', e.message || e);
    }
  });

  bot.action('addserver_reseller', async (ctx) => {
    await ctx.answerCbQuery().catch(() => {});
    userState[ctx.chat.id] = { step: 'reseller_domain' };
    await ctx.reply('🌐 Masukkan domain server reseller:');
  });

  bot.action('tambah_saldo', async (ctx) => {
    await ctx.answerCbQuery().catch(() => {});
    const adminId = ctx.from.id;
    if (!isAdmin(adminId, adminIds)) {
      return toastError(ctx, 'Kamu tidak memiliki izin');
    }

    userState[adminId] = { step: 'addsaldo_userid' };
    await ctx.reply('🔢 Masukkan ID Telegram user yang ingin ditambahkan saldo:');
  });

  bot.action('sendMainMenu', async (ctx) => {
    try {
      await ctx.answerCbQuery().catch(() => {});
      await sendMainMenu(ctx);
    } catch (error) {
      logger.error('❌ Error saat kembali ke menu utama:', error);
      await ctx.reply('⚠️ Terjadi kesalahan saat membuka menu utama.');
    }
  });
}

module.exports = { registerUserMenuHandlers };
