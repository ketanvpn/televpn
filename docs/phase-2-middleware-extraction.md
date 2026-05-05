# Phase 2 - Middleware Extraction Progress

Fase ini memindahkan middleware global Telegram dari `app.js` ke module terpisah tanpa mengubah behavior.

## Status Saat Ini

Selesai:

- Extract callback rate limit middleware ke `src/bot/middleware/callbackRateLimit.js`
- Extract cleanup interval untuk cache callback ke module yang sama
- Extract transaction/action lock middleware ke `src/bot/middleware/transactionLock.js`
- Extract private chat guard ke `src/bot/guards/privateChat.js`
- Extract license info getter dan license guard ke `src/bot/guards/license.js`
- Extract access messages dan parser admin IDs ke `src/bot/guards/access.js`
- Replace admin checks area GoPay API key dengan `isAdmin()` helper
- Replace checks `/testgroup`, `/daily_report_test`, `/backup_auto_test`, `/lisensi`, `/health` dengan access helpers
- Wiring di `app.js` tetap berada di posisi lama
- Syntax check `app.js`, `callbackRateLimit.js`, `transactionLock.js`, `privateChat.js`, `license.js`, dan `access.js` bersih

## File Baru

- `src/bot/middleware/callbackRateLimit.js`
- `src/bot/middleware/transactionLock.js`
- `src/bot/guards/privateChat.js`
- `src/bot/guards/license.js`
- `src/bot/guards/access.js`

## Perubahan di app.js

- `cbRateLimit` dan `cbSameDataLock` tidak lagi inline di `app.js`
- `setInterval` cleanup callback cache sekarang lewat `startCallbackRateLimitCleanup()`
- `bot.on('callback_query', ...)` sekarang memakai `callbackRateLimitMiddleware()`
- `txLock` dan `isTxAction()` tidak lagi inline di `app.js`
- Lock transaksi create/renew/trial/topup sekarang memakai `transactionLockMiddleware()`
- `ensurePrivateChat()` tidak lagi inline di `app.js`
- `getLicenseInfo()` sekarang dibuat lewat `createLicenseInfoGetter(() => EXPIRE_DATE)`
- Middleware kunci lisensi sekarang memakai `licenseGuardMiddleware({ getLicenseInfo, masterId: MASTER_ID })`
- `NO_ACCESS_MESSAGE`, `MASTER_ONLY_MESSAGE`, dan parsing `ADMIN_IDS_RAW` sekarang berasal dari access guard helper
- Permission check GoPay API key sekarang memakai `isAdmin(ctx.from?.id, ADMIN_IDS)`
- Permission check beberapa command admin/master awal sekarang memakai `isAdmin()` dan `isMaster()`

## Validasi

Command syntax check yang sudah dijalankan:

```bash
node --check app.js
node --check src/bot/middleware/callbackRateLimit.js
node --check src/bot/middleware/transactionLock.js
node --check src/bot/guards/privateChat.js
node --check src/bot/guards/license.js
node --check src/bot/guards/access.js
```

Hasil: tidak ada error syntax.

## Next Step Aman

1. Gradual replace permission checks dengan helper `isAdmin`, `isMaster`, `isAdminOrMaster` bila aman.
2. Extract command handler groups kecil per domain.
