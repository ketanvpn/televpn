# Phase 3 - Command Group Extraction

Fase ini memecah handler command/callback besar dari `app.js` ke module terpisah, mulai dari grup yang paling terisolasi.

## Status Awal

Selesai:

- Extract promo template callbacks ke `src/bot/handlers/promoTemplates.js`
- Extract broadcast menu callbacks ke `src/bot/handlers/broadcastMenu.js`

## Target Aman Berikutnya

1. Extract reseller target / bonus callbacks.
2. Extract server management callbacks.
3. Extract reseller/admin utility callbacks lainnya.

## Aturan

- Behavior tidak berubah.
- Setiap ekstraksi kecil harus syntax check.
- Commit dan push setiap batch.
