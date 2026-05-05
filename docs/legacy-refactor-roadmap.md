# Roadmap Refactor Bot Lama

Roadmap ini menjadi panduan utama untuk merapikan bot lama yang pusatnya ada di `app.js` tanpa rewrite total. Targetnya: fitur lama tetap jalan, tetapi struktur kode dibuat modular supaya maintenance lebih mudah dan risiko error data lebih kecil.

## Prinsip Utama

- Jangan rewrite total dari nol.
- Jangan ubah behavior fitur yang sudah jalan kecuali memang sedang memperbaiki bug.
- Pecah file bertahap, satu domain fitur per tahap.
- Setelah setiap tahap, bot harus tetap bisa jalan.
- Database lama tetap dipertahankan dulu.
- Command dan callback lama tetap dipertahankan dulu agar user tidak bingung.
- Setiap perubahan finansial/saldo harus aman dan tercatat.

## Target Struktur Akhir

```text
BotVPN/
  app.js
  src/
    core/
      config.js
      logger.js
      db.js
      paths.js
      formatters.js
      telegramSafeHtml.js
    bot/
      createBot.js
      middleware/
        privateChat.js
        callbackRateLimit.js
        licenseGuard.js
        cleanMenu.js
      menus/
        mainMenu.js
        adminMenu.js
        resellerMenu.js
      commands/
        userCommands.js
        adminCommands.js
        saldoCommands.js
        serverCommands.js
      actions/
        userActions.js
        adminActions.js
        paymentActions.js
    features/
      accounts/
        accountService.js
        accountHandlers.js
        provisioningClient.js
      payment/
        qrisService.js
        qrisRepository.js
        qrisHandlers.js
      trial/
        trialService.js
        trialConfigRepository.js
        trialHandlers.js
      reseller/
        resellerService.js
        resellerRepository.js
        resellerHandlers.js
      broadcast/
        broadcastService.js
        broadcastHandlers.js
      backup/
        backupService.js
        backupHandlers.js
      reports/
        dailyReportService.js
        expiryReminderService.js
      admin/
        adminDashboardService.js
        auditService.js
    repositories/
      userRepository.js
      serverRepository.js
      transactionRepository.js
      accountRepository.js
```

## Fase 0 - Baseline dan Safety

Tujuan: memastikan kondisi awal aman sebelum refactor.

- Backup `app.js`, `.vars.json`, dan database runtime.
- Catat command dan callback penting dari bot lama.
- Pastikan `.gitignore` tidak commit secret dan database.
- Pastikan repo GitHub selalu update sebelum perubahan besar.
- Tambahkan checklist test manual dasar.

Checklist test dasar:
- `/start` dan `/menu`
- `/admin`
- topup QRIS
- create/trial/renew/delete
- lock/unlock
- add/min saldo
- reseller add/remove
- backup
- broadcast
- report/reminder

## Fase 1 - Core Extraction

Tujuan: mengurangi beban `app.js` tanpa menyentuh logic bisnis.

Yang dipindah:
- logger Winston
- pembacaan `.vars.json`
- helper path dan file config
- helper format rupiah/tanggal
- helper Markdown/HTML safe reply
- SQLite connection wrapper jika memungkinkan tanpa ubah query besar

Output:
- `src/core/logger.js`
- `src/core/config.js`
- `src/core/paths.js`
- `src/core/formatters.js`
- `src/core/telegramSafeHtml.js`

Risiko: rendah.

## Fase 2 - Middleware Bot

Tujuan: middleware global tidak lagi bercampur dengan fitur.

Yang dipindah:
- private chat guard
- license guard
- callback rate limit
- transaction/action lock
- clean menu helper
- HTML/Markdown patcher

Output:
- `src/bot/middleware/privateChat.js`
- `src/bot/middleware/licenseGuard.js`
- `src/bot/middleware/callbackRateLimit.js`
- `src/bot/middleware/transactionLock.js`
- `src/bot/middleware/cleanMenu.js`

Risiko: sedang, karena middleware mempengaruhi semua handler.

## Fase 3 - Repository Layer

Tujuan: query DB mulai dipusatkan agar tidak tersebar di semua handler.

Prioritas repository:
- user repository
- server repository
- transaction repository
- account repository
- qris payment repository
- reseller repository

Aturan:
- Jangan ubah struktur tabel dulu.
- Query lama boleh tetap, tetapi fungsi baru harus lewat repository.
- Query finansial harus jelas transaction boundary-nya.

Risiko: sedang.

## Fase 4 - Payment QRIS Extraction

Tujuan: QRIS adalah fitur kritis finansial, jadi harus paling rapi.

Yang dipindah:
- config GoPay/QRIS
- generate invoice
- cek status invoice
- polling mutasi/payment
- finalize payment dan update saldo
- bonus topup
- notif user/grup

Output:
- `src/features/payment/qrisService.js`
- `src/features/payment/qrisRepository.js`
- `src/features/payment/qrisHandlers.js`

Syarat selesai:
- Tidak ada double credit.
- Invoice paid tidak bisa diproses dua kali.
- Expired tidak bisa berubah paid tanpa transaksi valid.
- Semua topup tercatat di `transactions`.

Risiko: tinggi, wajib test teliti.

## Fase 5 - Account Lifecycle Extraction

Tujuan: create/trial/renew/delete/lock/unlock akun dipusatkan.

Yang dipindah:
- module create/trial/renew/delete/lock/unlock
- access check server reseller-only
- pencatatan akun ke DB
- validasi saldo
- limit create server/user
- pesan hasil akun

Output:
- `src/features/accounts/provisioningClient.js`
- `src/features/accounts/accountService.js`
- `src/features/accounts/accountHandlers.js`

Syarat selesai:
- Create saldo tidak dobel terpotong.
- Akun tercatat setelah provider sukses.
- Kalau provider gagal, saldo tidak hilang.
- Lock/unlock update status akun lokal.

Risiko: tinggi.

## Fase 6 - Saldo dan User Management

Tujuan: semua operasi saldo dan user konsisten.

Yang dipindah:
- `/addsaldo`
- `/minsaldo`
- `/listuser`
- `/deluser`
- `/setflag`
- cek saldo user
- riwayat saldo user

Syarat selesai:
- Semua saldo lewat ledger `transactions`.
- Admin action tercatat.
- User diberi notif saat saldo berubah.

Risiko: sedang-tinggi.

## Fase 7 - Reseller System

Tujuan: fitur reseller lama tetap masuk, tapi lebih mudah dirawat.

Yang dipindah:
- add/remove/list reseller
- reseller-only server
- discount reseller
- reseller target
- reseller active bonus
- sales summary reseller

Output:
- `src/features/reseller/resellerService.js`
- `src/features/reseller/resellerRepository.js`
- `src/features/reseller/resellerHandlers.js`

Syarat selesai:
- Role reseller konsisten antara file/DB lama.
- Harga reseller dihitung jelas.
- Bonus reseller tidak bisa diproses dobel.

Risiko: tinggi.

## Fase 8 - Broadcast dan Admin Tools

Tujuan: admin tools tidak bercampur di `app.js`.

Yang dipindah:
- broadcast all/reseller/member
- last broadcast summary
- hapus log
- test group
- health/status bot
- admin dashboard
- backup manual

Output:
- `src/features/broadcast/broadcastService.js`
- `src/features/broadcast/broadcastHandlers.js`
- `src/features/admin/adminDashboardService.js`

Syarat selesai:
- Broadcast ada summary target/berhasil/gagal.
- Ada delay untuk hindari rate limit Telegram.
- Admin action tercatat.

Risiko: sedang.

## Fase 9 - Scheduler dan Report

Tujuan: semua job otomatis dipusatkan.

Yang dipindah:
- auto backup
- daily report
- expiry reminder
- reseller target check
- reseller active bonus scheduler jika ada

Output:
- `src/features/reports/dailyReportService.js`
- `src/features/reports/expiryReminderService.js`
- `src/features/backup/backupService.js`

Syarat selesai:
- Scheduler tidak jalan dobel di cluster/PM2.
- Setiap scheduler punya guard date key.
- Error scheduler tidak crash bot.

Risiko: sedang.

## Fase 10 - UI/UX Polish

Tujuan: user dan admin nyaman pakai bot.

Yang dirapikan:
- main menu
- admin menu
- reseller menu
- topup invoice message
- account result message
- error message
- help/admin command list

Aturan:
- Jangan membuat pesan terlalu panjang.
- Semua HTML harus aman.
- Tombol inline punya callback yang konsisten.
- User diberi instruksi jelas saat input salah.

Risiko: rendah-sedang.

## Fase 11 - Cleanup `app.js`

Tujuan: `app.js` tinggal bootstrap dan wiring.

Target akhir `app.js`:

```js
const { createBot } = require('./src/bot/createBot');
const { startSchedulers } = require('./src/features/reports/schedulers');

async function main() {
  const bot = await createBot();
  startSchedulers(bot);
  await bot.launch();
}

main();
```

Syarat selesai:
- Tidak ada handler besar di `app.js`.
- Semua fitur pindah ke module.
- Bot tetap kompatibel dengan DB lama.

## Prioritas Eksekusi Praktis

Urutan kerja yang disarankan:

1. Fase 0 - baseline dan safety
2. Fase 1 - core extraction
3. Fase 2 - middleware bot
4. Fase 4 - payment QRIS
5. Fase 5 - account lifecycle
6. Fase 6 - saldo/user management
7. Fase 7 - reseller
8. Fase 8 - broadcast/admin tools
9. Fase 9 - scheduler/report
10. Fase 10 - UI/UX polish
11. Fase 11 - cleanup app.js

## Definition of Done

Refactor dianggap selesai jika:

- `app.js` sudah ringkas dan hanya bootstrap/wiring.
- Semua fitur lama masih tersedia.
- Semua command utama sudah dites manual.
- Tidak ada perubahan saldo tanpa transaction log.
- Tidak ada file secret/database masuk GitHub.
- Error utama dikirim ke log/alert admin.
- Backup otomatis tetap jalan.
- Dokumentasi fitur dan command sudah update.
