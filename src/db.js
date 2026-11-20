import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { config } from './config.js';

const dbPath = path.resolve(config.DB_PATH);

fs.mkdirSync(path.dirname(dbPath), { recursive: true });

export const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export function run(sql, params = {}) {
  return db.prepare(sql).run(params);
}

export function get(sql, params = {}) {
  return db.prepare(sql).get(params);
}

export function all(sql, params = {}) {
  return db.prepare(sql).all(params);
}

export function tx(fn) {
  const transaction = db.transaction(fn);
  return transaction();
}

export function migrate() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  const applied = new Set(
    all('SELECT version FROM schema_migrations').map(row => row.version)
  );

  for (const migration of migrations) {
    if (!applied.has(migration.version)) {
      tx(() => {
        db.exec(migration.sql);

        run(
          'INSERT INTO schema_migrations(version) VALUES(@version)',
          { version: migration.version }
        );
      });
    }
  }
}

const migrations = [
  {
    version: 1,
    sql: `
      CREATE TABLE users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        telegram_user_id INTEGER NOT NULL UNIQUE,
        username TEXT,
        first_name TEXT NOT NULL DEFAULT '',
        last_name TEXT NOT NULL DEFAULT '',
        language TEXT NOT NULL DEFAULT 'bn',
        referral_code TEXT NOT NULL UNIQUE,
        referred_by_user_id INTEGER,
        status TEXT NOT NULL DEFAULT 'active',
        notes TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(referred_by_user_id) REFERENCES users(id)
      );

      CREATE TABLE plans (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        price REAL NOT NULL CHECK(price > 0),
        duration_days INTEGER NOT NULL CHECK(duration_days > 0),
        schedule TEXT NOT NULL DEFAULT '',
        description TEXT NOT NULL DEFAULT '',
        terms TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'active',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE user_plans (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        plan_id INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        activated_at TEXT,
        expires_at TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(user_id) REFERENCES users(id),
        FOREIGN KEY(plan_id) REFERENCES plans(id)
      );

      CREATE TABLE deposits (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        request_id TEXT NOT NULL UNIQUE,
        user_id INTEGER NOT NULL,
        method TEXT NOT NULL CHECK(method IN('bkash', 'nagad')),
        amount REAL NOT NULL CHECK(amount > 0),
        reference TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        admin_note TEXT,
        reviewed_by INTEGER,
        reviewed_at TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(user_id) REFERENCES users(id)
      );

      CREATE TABLE withdrawals (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        request_id TEXT NOT NULL UNIQUE,
        user_id INTEGER NOT NULL,
        method TEXT NOT NULL CHECK(method IN('bkash', 'nagad')),
        account_number TEXT NOT NULL,
        amount REAL NOT NULL CHECK(amount > 0),
        status TEXT NOT NULL DEFAULT 'pending',
        admin_note TEXT,
        reviewed_by INTEGER,
        reviewed_at TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(user_id) REFERENCES users(id)
      );

      CREATE TABLE transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        transaction_id TEXT NOT NULL UNIQUE,
        user_id INTEGER NOT NULL,
        type TEXT NOT NULL CHECK(
          type IN('deposit', 'withdrawal', 'plan', 'referral', 'adjustment')
        ),
        amount REAL NOT NULL,
        status TEXT NOT NULL,
        reference TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(user_id) REFERENCES users(id)
      );

      CREATE TABLE referrals (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        referrer_user_id INTEGER NOT NULL,
        referred_user_id INTEGER NOT NULL UNIQUE,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(referrer_user_id) REFERENCES users(id),
        FOREIGN KEY(referred_user_id) REFERENCES users(id)
      );

      CREATE TABLE support_tickets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ticket_number TEXT NOT NULL UNIQUE,
        user_id INTEGER NOT NULL,
        category TEXT NOT NULL,
        message TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'open',
        admin_reply TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(user_id) REFERENCES users(id)
      );

      CREATE TABLE notices (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        category TEXT NOT NULL,
        title TEXT NOT NULL,
        body TEXT NOT NULL,
        audience TEXT NOT NULL DEFAULT 'all',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE notifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        body TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'queued',
        attempts INTEGER NOT NULL DEFAULT 0,
        last_error TEXT,
        sent_at TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(user_id) REFERENCES users(id)
      );

      CREATE TABLE audit_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        admin_telegram_user_id INTEGER NOT NULL,
        action TEXT NOT NULL,
        target_type TEXT,
        target_id TEXT,
        old_value TEXT,
        new_value TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE payment_settings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        method TEXT NOT NULL UNIQUE CHECK(method IN('bkash', 'nagad')),
        enabled INTEGER NOT NULL DEFAULT 0,
        account_number TEXT NOT NULL DEFAULT '',
        instructions TEXT NOT NULL DEFAULT '',
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE system_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX idx_users_ref
        ON users(referred_by_user_id);

      CREATE INDEX idx_dep_status
        ON deposits(status);

      CREATE INDEX idx_wd_status
        ON withdrawals(status);

      CREATE INDEX idx_tx_user
        ON transactions(user_id, created_at DESC);

      CREATE INDEX idx_notif_status
        ON notifications(status);

      CREATE INDEX idx_tickets_status
        ON support_tickets(status);

      INSERT OR IGNORE INTO payment_settings
        (method, enabled, account_number, instructions)
      VALUES
        (
          'bkash',
          0,
          '',
          'Admin can configure bKash number/instructions'
        ),
        (
          'nagad',
          0,
          '',
          'Admin can configure Nagad number/instructions'
        );

      INSERT OR IGNORE INTO system_settings(key, value)
      VALUES
        (
          'maintenance',
          '{"enabled":false,"message":"System maintenance is in progress."}'
        );
    `
  }
];
