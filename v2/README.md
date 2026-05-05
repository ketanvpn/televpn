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

## Notes for next integration

- QRIS provider endpoint integration can be attached in `src/services/qrisService.js`.
- Provisioning API integration (create/trial/renew/delete account) should be added as separate modules under `src/services`.
