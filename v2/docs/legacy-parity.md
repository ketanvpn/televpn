# Legacy Parity Checklist

Checklist ini dipakai supaya fitur bagus dari bot lama tetap masuk ke v2, tetapi dengan struktur lebih rapi dan aman data.

## Sudah Masuk v2

- User auto-register dan saldo
- Role `master`, `admin`, `reseller`, `member`
- QRIS topup live + polling + cek status invoice
- Create, trial, renew, delete akun VPN
- Lock dan unlock akun VPN
- Server management basic (`/addserver`, `/servers`)
- Broadcast all/reseller/member dengan summary
- Backup manual dan auto-backup DB
- Daily report manual dan scheduler
- Alert error kritis ke admin
- Admin audit log
- Maintenance mode + custom maintenance message
- Public status command (`/status`)
- Quick action menu untuk create/trial/renew/delete/lock/unlock/broadcast

## Wajib Masuk Berikutnya

- Manual saldo admin: add/min saldo + ledger + notif user (done)
- User management: list user, delete user, set flag/watchlist
- Reseller management: add/remove reseller dari menu/command
- Trial config admin: enabled, limit harian, durasi, minimal saldo
- Expiry reminder akun otomatis
- Report penjualan/reseller yang lebih lengkap
- Edit server: harga, domain, auth, quota, ip limit, limit create
- Import/migrasi data dari database lama jika diperlukan

## Prinsip Migrasi

- Jangan copy handler besar dari `app.js` lama secara mentah.
- Ambil perilaku bisnisnya, lalu masukkan ke service/repository v2.
- Semua perubahan saldo wajib tercatat di `transactions` dengan `reference_id` unik.
- Semua aksi admin penting wajib masuk `admin_audit_logs`.
- Pesan ke user wajib konsisten dan aman HTML parse.
