# Spawncamper

A personal price tracker. Watches products across multiple retailers, logs price changes over time, and pings me on Telegram when something moves.

## Goal

Stop manually checking prices. Add a product once, attach the URLs from each retailer that sells it, and let the system tell me when a price drops (or jumps).

## Scope (v1)

**In scope**
- Add / pause / archive / delete products
- Each product can have N URLs (one per retailer)
- Periodic price check across all active product URLs
- Persist a price history log (only on change, or on every check — TBD)
- Notify on price change via Telegram
- Web UI to manage products and view history
- CLI for the same management actions and ad-hoc one-off checks

**Out of scope (for now)**
- Multi-user / auth
- Other notification channels (email, Discord, push)
- Auto-purchase bot — flagged as a possible LATER in `core/src/index.ts`

## Architecture

pnpm workspace monorepo. Each package is independent and depends on `@spawncamper/core` for shared logic.

```
packages/
  core/          shared domain logic — products, scraping, price comparison, storage, notifications
  cli/           command-line interface — `pt <command>`
  web/           Vite + React frontend for managing products
  telegram-bot/  outbound notifier (and possibly inbound commands later)
```

**Data flow**
1. A scheduled run (cron / CLI) calls `checkPrice()` in core
2. Core fetches each active product URL, parses price
3. Core compares against the latest stored price
4. On change → write to price history → fire Telegram notification

## Tech

- TypeScript across the board
- pnpm workspaces
- Vite + React for `web`
- Node CLI for `cli`
- Telegram bot API for notifications
- **Storage: SQLite (leaning `better-sqlite3`)** — see `Storage` below

## Storage

SQLite, single file at the repo root or `~/.spawncamper/`. Chosen over JSON because the price-history table is append-heavy and queryable by time range; chosen over Postgres/Mongo because there's no need for a server in a single-user tool.

Sketch:

- `products` — id, name, target_price, status, created_at
- `product_urls` — id, product_id, url, retailer, scrape_config, active
- `price_checks` — id, product_url_id, price, currency, in_stock, checked_at  *(append-only log)*
- `notifications` — id, product_id, kind, sent_at  *(de-dupe so we don't spam on repeated drops)*

## Open questions

- Log every check, or only on change? (Logging every check makes "price stable for N days" trivial; logging only changes keeps the table small.)
- Where does the scheduler live — inside `cli` as `pt run`, a separate `scheduler` package, or just a system cron entry?
- Scrape strategy per retailer: shared selector config in DB, or per-retailer adapter modules in `core`?
- Notification de-dupe window — how long after a notification do we suppress further ones for the same product?

## Working principles

- I'm writing the code by hand. AI is for decision-making and second opinions, not implementation.
- Keep `core` framework-agnostic so CLI, web backend and bot all share one source of truth.
- Defer everything that isn't on the critical path to "watch a product, get notified".
