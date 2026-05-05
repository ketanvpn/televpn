# Phase 1 - Core Extraction Progress

Fase ini memecah bagian core dari `app.js` tanpa mengubah behavior fitur bot lama.

## Status Saat Ini

Selesai:

- Extract logger Winston ke `src/core/logger.js`
- Extract path penting ke `src/core/paths.js`
- Extract formatter `rupiah` ke `src/core/formatters.js`
- Extract helper Markdown-to-HTML ke `src/core/telegramSafeHtml.js`
- Update `app.js` agar memakai module core baru
- Syntax check `app.js`, `logger.js`, `paths.js`, `formatters.js`, dan `telegramSafeHtml.js` bersih

## File Baru

- `src/core/logger.js`
- `src/core/paths.js`
- `src/core/formatters.js`
- `src/core/telegramSafeHtml.js`

## Perubahan di app.js

- Setup Winston tidak lagi langsung berada di `app.js`
- `VARS_PATH`, `trial.db`, dan `trial_config.json` sekarang memakai konstanta dari `src/core/paths.js`
- `rupiah` sekarang dipakai dari `src/core/formatters.js`
- `mdToHtml` sekarang dipakai dari `src/core/telegramSafeHtml.js`

## Belum Dipindah

Bagian berikut sengaja belum dipindah karena risikonya lebih tinggi dan perlu tahap terpisah:

- `vars` store dan fungsi `readVarsFresh` / `writeVarsPartial`
- helper tanggal lain yang masih inline di beberapa fitur
- database wrapper/query
- middleware Telegram

## Validasi

Command syntax check yang sudah dijalankan:

```bash
node --check app.js
node --check src/core/logger.js
node --check src/core/paths.js
node --check src/core/formatters.js
node --check src/core/telegramSafeHtml.js
```

Hasil: tidak ada error syntax.

## Next Step Aman

Lanjut ekstraksi kecil berikutnya:

1. Extract `vars` config store secara hati-hati.
2. Extract helper clean menu/middleware Telegram.
3. Setelah itu baru masuk middleware license/callback lock.
