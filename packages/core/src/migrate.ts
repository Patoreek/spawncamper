import type Database from 'better-sqlite3';

  const SCHEMA = `
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS products (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      name         TEXT    NOT NULL,
      target_price REAL,
      status       TEXT    NOT NULL DEFAULT 'active'
                   CHECK (status IN ('active', 'paused', 'archived')),
      created_at   TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS product_urls (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id    INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      url           TEXT    NOT NULL,
      retailer      TEXT    NOT NULL,
      scrape_config TEXT,
      active        INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
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
      checked_at     TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_price_checks_url_time
      ON price_checks(product_url_id, checked_at DESC);

    CREATE TABLE IF NOT EXISTS notifications (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      kind       TEXT    NOT NULL,
      sent_at    TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_notifications_dedupe
      ON notifications(product_id, kind, sent_at DESC);
  `;

  export const migrate = (db: Database.Database) => {
    db.exec(SCHEMA);
  };