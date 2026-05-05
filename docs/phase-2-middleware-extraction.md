# Phase 2 - Middleware Extraction Progress

Fase ini memindahkan middleware global Telegram dari `app.js` ke module terpisah tanpa mengubah behavior.

## Status Saat Ini

Selesai:

- Extract callback rate limit middleware ke `src/bot/middleware/callbackRateLimit.js`
- Extract cleanup interval untuk cache callback ke module yang sama
- Extract transaction/action lock middleware ke `src/bot/middleware/transactionLock.js`
- Extract private chat guard ke `src/bot/guards/privateChat.js`
- Extract license info getter dan license guard ke `src/bot/guards/license.js`
- Wiring di `app.js` tetap berada di posisi lama
- Syntax check `app.js`, `callbackRateLimit.js`, `transactionLock.js`, `privateChat.js`, dan `license.js` bersih

## File Baru

- `src/bot/middleware/callbackRateLimit.js`
- `src/bot/middleware/transactionLock.js`
- `src/bot/guards/privateChat.js`
- `src/bot/guards/license.js`

## Perubahan di app.js

- `cbRateLimit` dan `cbSameDataLock` tidak lagi inline di `app.js`
- `setInterval` cleanup callback cache sekarang lewat `startCallbackRateLimitCleanup()`
- `bot.on('callback_query', ...)` sekarang memakai `callbackRateLimitMiddleware()`
- `txLock` dan `isTxAction()` tidak lagi inline di `app.js`
- Lock transaksi create/renew/trial/topup sekarang memakai `transactionLockMiddleware()`
- `ensurePrivateChat()` tidak lagi inline di `app.js`
- `getLicenseInfo()` sekarang dibuat lewat `createLicenseInfoGetter(() => EXPIRE_DATE)`
- Middleware kunci lisensi sekarang memakai `licenseGuardMiddleware({ getLicenseInfo, masterId: MASTER_ID })`

## Validasi

Command syntax check yang sudah dijalankan:

```bash
node --check app.js
node --check src/bot/middleware/callbackRateLimit.js
node --check src/bot/middleware/transactionLock.js
node --check src/bot/guards/privateChat.js
node --check src/bot/guards/license.js
```

Hasil: tidak ada error syntax.

## Next Step Aman

1. Extract permission/access helpers.
2. Extract command handler groups kecil per domain.
