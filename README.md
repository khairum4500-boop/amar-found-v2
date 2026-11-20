# AMAR FOUND v2

Production-oriented Telegram bot + admin controller using embedded SQLite. The deployment requires only `BOT_TOKEN` and `ADMIN_IDS` by default; the database is stored at `./data/amar-found.sqlite` and created/migrated automatically.

## Included
- Telegram registration + Bangla/English selection
- Persistent user menu and profile
- Admin-configurable bKash and Nagad payment instructions/number
- Deposit and withdrawal request/review workflow
- Transaction records and audit log
- Referral tracking and referral links
- Plans catalog and terms
- Support tickets + admin replies
- Notices
- Maintenance mode
- Admin dashboard
- Automatic SQLite migrations
- WAL mode + foreign keys
- Server-side admin allowlist
- Health endpoint
- No DATABASE_URL or APP_BASE_URL required

## Required environment variables
```env
BOT_TOKEN=...
ADMIN_IDS=123456789,987654321
```

Optional:
```env
PORT=3000
NODE_ENV=production
TIMEZONE=Asia/Dhaka
DB_PATH=./data/amar-found.sqlite
```

## Run
```bash
npm install
npm start
```

Open `/admin/` for the admin controller. The admin API requires the numeric Telegram ID from `ADMIN_IDS` in the `x-telegram-admin-id` header. Do not expose the admin panel publicly without adding a stronger authentication layer or a private network boundary.

## Payment settings
Admin can enable/disable and change **bKash** and **Nagad** account numbers and instructions from the admin panel. No payment number is hard-coded in the bot.

## Important scope
This project provides request-and-review interfaces. It does not implement guaranteed investment returns, profit calculations, or automated financial payouts.

## Deployment note
SQLite removes the need for a `DATABASE_URL`, but the filesystem must be persistent if you need data to survive service replacement/redeployment. If your hosting plan has ephemeral storage, use a persistent disk or backup strategy.
