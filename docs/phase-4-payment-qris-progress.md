# Fase 4 - Payment QRIS Extraction (Progress)

Dokumen ini mencatat progres eksekusi Fase 4 secara teknis agar sinkron dengan pola dokumen per-fase di folder `docs`.

## Status

- Status: **Done (gelombang-1 + gelombang-2 selesai)**
- Branch kerja saat ini: `phase-3-refactor-wip`
- Update terakhir: 2026-05-08

## Yang Sudah Selesai (Gelombang-1)

### Service extraction

- `src/services/qrisUtils.js`
  - `parseProviderTransactionTime`
  - `buildProviderTransactionFingerprint`
  - `findMatchingSettlementTransaction`
- `src/services/gopayQrisApi.js`
  - `fetchTransactions`
  - `generateQris`
  - `fetchQrisStatus`
- `src/services/qrisInvoiceStatusService.js`
  - checker status invoice (`PAID/PENDING/EXPIRED/CANCELED`)
- `src/services/qrisPaymentFinalizeService.js`
  - finalize payment QRIS
  - apply bonus topup QRIS
- `src/services/qrisNotificationService.js`
  - notifikasi topup berhasil (user + grup)
  - notifikasi expired
- `src/services/qrisPayloadUtils.js`
  - builder payload/image URL QRIS
- `src/services/qrisInvoiceBuilderService.js`
  - create invoice QRIS (suffix/amount mapping)
- `src/services/qrisPollingService.js`
  - polling startup QRIS payment
- `src/services/qrisPendingDepositMonitorService.js`
  - monitor legacy `pending_deposits`
- `src/services/qrisTopupFlowService.js`
  - flow `processQrisTopupInvoice`

### Handler modularization

- `src/bot/handlers/qrisTopup.js` sudah jadi titik utama UI QRIS untuk:
  - `topupqris`
  - `topupqris_btn`
  - `qris_topup_confirm_yes`
  - `qris_topup_confirm_cancel`
  - `qris_auto_topup`
  - `upload_qris`
  - `topup_manual`
  - `qris_status:*`

## Dampak ke app.js

- Domain QRIS di `app.js` sudah banyak berubah menjadi wrapper/delegasi ke service/handler.
- Registrasi callback QRIS duplikat di `app.js` sudah dibersihkan.

## Catatan Penting

- Behavior finansial dipertahankan (tidak ada rewrite total).
- Boundary transaksi untuk finalisasi QRIS tetap dijaga.
- Verifikasi sintaks per-batch sudah dijalankan (`node --check`).

## Lanjut Gelombang-2

- Gelombang-2 QRIS selesai:
  - Polling mutasi `pending_deposits` dipindah ke `src/services/qrisPendingDepositMonitorService.js`.
  - `startAutoTopupMutasi` sekarang dijalankan dari service (`qrisPendingDepositMonitorService.startAutoTopupMutasi(...)`) dan bukan lagi function legacy di `app.js`.
  - Function legacy QRIS mutasi di `app.js` (`pollMutasi`, `startAutoTopupMutasi`, parser helper terkait) sudah dibersihkan.

## Kesimpulan

- Fase 4 dianggap selesai karena domain payment QRIS sudah terpisah ke service + handler modular, termasuk jalur monitor mutasi legacy dan polling startup.
- Lanjutan pekerjaan fokus ke fase berikutnya (saldo/user management, reseller, admin tools, dan penipisan `app.js`).
