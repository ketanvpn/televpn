# Phase 1 - Core Extraction Progress

Fase ini memecah bagian core dari `app.js` tanpa mengubah behavior fitur bot lama.

## Status Saat Ini

Selesai:

- Extract logger Winston ke `src/core/logger.js`
- Extract path penting ke `src/core/paths.js`
- Update `app.js` agar memakai module core baru
- Syntax check `app.js`, `logger.js`, dan `paths.js` bersih

## File Baru

- `src/core/logger.js`
- `src/core/paths.js`

## Perubahan di app.js

- Setup Winston tidak lagi langsung berada di `app.js`
- `VARS_PATH`, `trial.db`, dan `trial_config.json` sekarang memakai konstanta dari `src/core/paths.js`

## Belum Dipindah

Bagian berikut sengaja belum dipindah karena risikonya lebih tinggi dan perlu tahap terpisah:

- `vars` store dan fungsi `readVarsFresh` / `writeVarsPartial`
- formatter besar seperti `rupiah`, `mdToHtml`, dan helper menu
- database wrapper/query
- middleware Telegram

## Validasi

Command syntax check yang sudah dijalankan:

```bash
node --check app.js
node --check src/core/logger.js
node --check src/core/paths.js
```

Hasil: tidak ada error syntax.

## Next Step Aman

Lanjut ekstraksi kecil berikutnya:

1. `src/core/formatters.js` untuk `rupiah`, tanggal, dan helper text kecil.
2. `src/core/telegramSafeHtml.js` untuk `mdToHtml` dan HTML-safe helper.
3. Setelah itu baru masuk middleware Telegram.
