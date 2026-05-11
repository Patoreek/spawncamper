import type Database from 'better-sqlite3';

  const SCHEMA = `
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS products (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      name         TEXT    NOT NULL,
      target_price REAL,
      status       TEXT    NOT NULL DEFAULT 'active'
                   CHECK (status IN ('active', 'paused', 'archived')),
      notify_enabled INTEGER NOT NULL DEFAULT 0 CHECK (notify_enabled IN (0, 1)),
      notify_kind    TEXT,
      notify_value   REAL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS product_urls (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id      INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      url             TEXT    NOT NULL,
      retailer        TEXT    NOT NULL,
      scrape_config   TEXT,
      active          INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (product_id, url)
    );

    CREATE INDEX IF NOT EXISTS idx_product_urls_product
      ON product_urls(product_id) WHERE active = 1;

    CREATE TABLE IF NOT EXISTS price_checks (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      product_url_id INTEGER NOT NULL REFERENCES product_urls(id) ON DELETE CASCADE,
      price          REAL    NOT NULL,
      currency       TEXT    NOT NULL,
      in_stock       INTEGER NOT NULL CHECK (in_stock IN (0, 1)),
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      kind       TEXT    NOT NULL,
      price      REAL,
      sent_at    TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_price_checks_url_time
      ON price_checks(product_url_id, created_at DESC);

    CREATE INDEX IF NOT EXISTS idx_notifications_dedupe
      ON notifications(product_id, kind, sent_at DESC);

    CREATE TABLE IF NOT EXISTS fx_rates (
      currency   TEXT PRIMARY KEY,
      rate       REAL NOT NULL,
      fetched_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS cron_runs (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      source           TEXT    NOT NULL CHECK (source IN ('scheduled', 'manual')),
      status           TEXT    NOT NULL CHECK (status IN ('running', 'success', 'error')),
      started_at       TEXT    NOT NULL DEFAULT (datetime('now')),
      completed_at     TEXT,
      products_checked INTEGER NOT NULL DEFAULT 0,
      urls_checked     INTEGER NOT NULL DEFAULT 0,
      error            TEXT
    );

    -- Race-safe single-runner constraint. Two concurrent processes (API +
    -- scheduler) cannot both insert a 'running' row.
    CREATE UNIQUE INDEX IF NOT EXISTS idx_cron_runs_only_one_running
      ON cron_runs(status) WHERE status = 'running';

    CREATE INDEX IF NOT EXISTS idx_cron_runs_started_at
      ON cron_runs(started_at DESC);
  `;

  // Idempotent column additions for pre-existing databases.
  // SQLite's ALTER TABLE ADD COLUMN errors if the column already exists, so we swallow.
  const ALTERS: string[] = [
    `ALTER TABLE products ADD COLUMN notify_enabled INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE products ADD COLUMN notify_kind TEXT`,
    `ALTER TABLE products ADD COLUMN notify_value REAL`,
    `ALTER TABLE notifications ADD COLUMN price REAL`,
  ];

  export const migrate = (db: Database.Database) => {
    db.exec(SCHEMA);
    for (const alter of ALTERS) {
      try { db.exec(alter); } catch { /* column already exists */ }
    }
  };
