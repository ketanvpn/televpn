# Phase 0 - Baseline Safety

Dokumen ini adalah checklist wajib sebelum mulai memecah `app.js`. Tujuannya memastikan kondisi awal tercatat, backup aman, dan setiap refactor berikutnya punya patokan test yang sama.

## Scope Phase 0

- Tidak mengubah logic bot lama.
- Tidak mengubah database runtime.
- Tidak mengubah command/callback user.
- Hanya menyiapkan baseline, checklist, dan prosedur safety.

## File Sensitif yang Tidak Boleh Masuk Git

- `.vars.json`
- `*.db`
- `*.log`
- `node_modules/`
- file backup database mentah

Status saat ini sudah dilindungi oleh `.gitignore`.

## Backup Wajib Sebelum Refactor Besar

Jalankan di VPS sebelum fase refactor yang menyentuh logic:

```bash
cd /root/televpn
mkdir -p /root/televpn-backup/manual-$(date +%Y%m%d-%H%M%S)
cp -f app.js /root/televpn-backup/manual-$(date +%Y%m%d-%H%M%S)/app.js 2>/dev/null || true
cp -f .vars.json /root/televpn-backup/manual-$(date +%Y%m%d-%H%M%S)/.vars.json 2>/dev/null || true
cp -f sellvpn.db /root/televpn-backup/manual-$(date +%Y%m%d-%H%M%S)/sellvpn.db 2>/dev/null || true
cp -f trial.db /root/televpn-backup/manual-$(date +%Y%m%d-%H%M%S)/trial.db 2>/dev/null || true
cp -f ressel.db /root/televpn-backup/manual-$(date +%Y%m%d-%H%M%S)/ressel.db 2>/dev/null || true
```

Catatan: command di atas sengaja defensif; kalau file tidak ada, tidak langsung gagal.

## Baseline Runtime Command

Command untuk cek kondisi bot lama di VPS:

```bash
pm2 status
pm2 logs sellvpn --lines 100
node -v
npm -v
```

Jika nama PM2 berbeda, sesuaikan dengan nama proses bot lama.

## Checklist Test Manual Bot Lama

Gunakan checklist ini setiap selesai satu fase refactor.

### User Basic

- `/start` tampil menu utama.
- `/menu` tampil menu utama.
- Saldo tampil benar.
- Tombol menu utama bisa diklik tanpa error.

### Payment QRIS

- User bisa mulai topup QRIS.
- Nominal valid menghasilkan invoice/QRIS.
- Nominal tidak valid ditolak dengan pesan jelas.
- Cek status invoice berjalan.
- Payment paid tidak menggandakan saldo.
- Invoice expired tidak diproses sebagai paid.

### Account Lifecycle

- Create SSH berhasil.
- Create VMess berhasil.
- Create VLESS berhasil.
- Create Trojan berhasil.
- Trial akun berhasil.
- Renew akun berhasil.
- Delete akun berhasil.
- Lock akun berhasil.
- Unlock akun berhasil.
- Jika provider error, saldo tidak hilang.

### Admin Saldo dan User

- `/addsaldo` berhasil dan user mendapat notif.
- `/minsaldo` berhasil dan user mendapat notif.
- Saldo tidak bisa minus.
- `/listuser` tampil.
- `/deluser` sesuai ekspektasi.
- `/setflag` sesuai ekspektasi.

### Server Management

- Tambah server normal.
- Tambah server reseller-only.
- Edit harga.
- Edit domain.
- Edit auth.
- Edit quota/iplimit/limit create.

### Reseller

- Add reseller.
- Delete reseller.
- Reseller melihat menu/fitur reseller.
- Member biasa tidak bisa akses server reseller-only.
- Harga reseller sesuai konfigurasi.

### Broadcast

- Broadcast all.
- Broadcast reseller.
- Broadcast member.
- Summary berhasil/gagal muncul.
- Tidak terkena spam/rate-limit berlebihan.

### Scheduler dan Report

- Backup manual.
- Auto backup aktif sesuai config.
- Daily report test.
- Expiry reminder test.
- Timezone sesuai konfigurasi.

### Maintenance Operasional

- `/health` atau status admin tampil.
- Hapus log berjalan.
- Bot restart PM2 tanpa kehilangan fungsi utama.

## Rollback Plan

Jika refactor menyebabkan bug serius:

```bash
cd /root/televpn
git log --oneline -n 5
git reset --hard <commit_sebelum_refactor>
npm install
pm2 restart sellvpn --update-env
pm2 logs sellvpn --lines 100
```

Rollback hanya dilakukan jika disetujui karena `git reset --hard` bersifat destruktif terhadap perubahan lokal.

## Definition of Done Phase 0

- Roadmap refactor tersedia.
- Checklist baseline tersedia.
- Prosedur backup tersedia.
- Prosedur rollback tersedia.
- Belum ada logic bot lama yang diubah.
