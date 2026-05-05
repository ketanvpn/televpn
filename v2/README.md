# BotVPN v2 Scaffold

This is a clean, modular scaffold for a Telegram VPN sales bot.

## Quick start

1. Copy `.env.example` to `.env` and fill required values.
2. Install dependencies:
   `npm install`
3. Run migration:
   `npm run migrate`
4. Start bot:
   `npm start`

## PM2 deployment

- Start with ecosystem:
  `pm2 start ecosystem.v2.config.js`
- Save process list:
  `pm2 save`
- Restart with env refresh:
  `pm2 restart televpn-v2 --update-env`

## Structure

- `src/core`: config, logger, db and shared utilities
- `src/db`: SQL schema and migration runner
- `src/repositories`: data access layer
- `src/services`: business logic layer
- `src/bot`: telegram handlers and middleware

## Included baseline features

- user auto-register on `/start`
- rich inline main menu (`/menu`)
- role-aware user/admin/reseller menu rendering
- saldo read via `/saldo`
- idempotent wallet ledger helper
- QRIS topup invoice flow (create invoice + admin finalize)
- callback anti-spam middleware

## Main commands

- `/start` or `/menu`: open dashboard
- `/me`: profile + role
- `/saldo`: current balance
- `/setrole <user_id> <member|reseller>`: admin only
- `/payok <invoice_id>`: admin settlement simulation
- `/cekqris <invoice_id>`: check and refresh QRIS status
- `/addserver <name>|<domain>|<auth>|<price>|<reseller_only 0/1>`: add provisioning server (admin)
- `/servers`: list active servers
- `/create <type> <username> <days> <server_id>`: create paid account
- `/trial <type> <server_id>`: create trial account (1 hour)
- `/renew <type> <username> <days> <server_id>`: renew account
- `/delete <type> <username> <server_id>`: delete account
- `/lock <type> <username> <server_id>`: lock account
- `/unlock <type> <username> <server_id>`: unlock account
- `/broadcastall <pesan>`: broadcast to all users (admin)
- `/broadcastres <pesan>`: broadcast to reseller users (admin)
- `/broadcastmem <pesan>`: broadcast to member users (admin)
- `/backupnow`: send DB backup now (admin)
- `/adminstats`: quick admin dashboard stats
- `/adminlogs`: show recent admin audit trail
- `/dailyreportnow`: send daily report immediately (admin)

Quick action buttons are available in `/menu`:
- `Quick Create`
- `Quick Trial`
- `Quick Renew`
- `Quick Delete`

## Notes for next integration

- QRIS live endpoint is ready via `GOPAY_API_KEY` and `GOPAY_API_BASE_URL` in `.env`.
- Provisioning API integration (create/trial/renew/delete account) should be added as separate modules under `src/services`.

## Backup scheduler env

- `AUTO_BACKUP_ENABLED=true|false`
- `AUTO_BACKUP_INTERVAL_MIN=360`
- `BACKUP_CHAT_ID=<telegram_chat_id>`

## Alert & report env

- `ALERT_CHAT_ID=<telegram_chat_id_for_alerts>`
- `DAILY_REPORT_ENABLED=true|false`
- `DAILY_REPORT_HOUR=23`
- `DAILY_REPORT_MINUTE=0`
