# Phase 1 - Core Extraction Progress

Fase ini memecah bagian core dari `app.js` tanpa mengubah behavior fitur bot lama.

## Status Saat Ini

Selesai:

- Extract logger Winston ke `src/core/logger.js`
- Extract path penting ke `src/core/paths.js`
- Extract formatter `rupiah` ke `src/core/formatters.js`
- Extract helper Markdown-to-HTML ke `src/core/telegramSafeHtml.js`
- Extract `.vars.json` store ke `src/core/varsStore.js`
- Extract template pesan standar ke `src/bot/ui/messages.js`
- Extract helper toast callback ke `src/bot/ui/toast.js`
- Update `app.js` agar memakai module core baru
- Syntax check `app.js`, `logger.js`, `paths.js`, `formatters.js`, `telegramSafeHtml.js`, `varsStore.js`, `messages.js`, dan `toast.js` bersih

## File Baru

- `src/core/logger.js`
- `src/core/paths.js`
- `src/core/formatters.js`
- `src/core/telegramSafeHtml.js`
- `src/core/varsStore.js`
- `src/bot/ui/messages.js`
- `src/bot/ui/toast.js`

## Perubahan di app.js

- Setup Winston tidak lagi langsung berada di `app.js`
- `VARS_PATH`, `trial.db`, dan `trial_config.json` sekarang memakai konstanta dari `src/core/paths.js`
- `rupiah` sekarang dipakai dari `src/core/formatters.js`
- `mdToHtml` sekarang dipakai dari `src/core/telegramSafeHtml.js`
- Load/read/write `.vars.json` sekarang didelegasikan ke `src/core/varsStore.js`
- `msgSuccess`, `msgError`, `msgInfo` sekarang dipakai dari `src/bot/ui/messages.js`
- `toast` dan `toastError` sekarang dipakai dari `src/bot/ui/toast.js`

## Belum Dipindah

Bagian berikut sengaja belum dipindah karena risikonya lebih tinggi dan perlu tahap terpisah:

- wrapper lokal `readVarsFresh` / `writeVarsPartial` masih ada untuk menjaga kompatibilitas state `vars`
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
node --check src/core/varsStore.js
node --check src/bot/ui/messages.js
node --check src/bot/ui/toast.js
```

Hasil: tidak ada error syntax.

## Next Step Aman

Lanjut ekstraksi kecil berikutnya:

1. Extract helper clean menu dengan hati-hati karena punya state `lastMenuMsgId`.
2. Extract middleware license/callback lock.
3. Setelah itu baru masuk repository/query layer kecil.
