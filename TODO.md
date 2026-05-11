# Spawncamper — TODO

Generated from a codebase walkthrough on 2026-05-11. Ranked roughly by leverage and effort.

## Bugs / drift to fix now

- [x] ~~Fix the CLI~~ — package removed entirely.
- [x] ~~Update README~~ — telegram-bot row replaced with messenger; CLI references dropped.
- [x] ~~Document `TELEGRAM_*` env vars in README~~ — added to the env block and a new Telegram Setup section.
- [x] ~~Currency-aware aggregation~~ — added `packages/core/src/fx/` (frankfurter.app rates, in-memory cache backed by `fx_rates` table). All read/aggregate paths now convert to AUD before comparing; per-URL display stays native with the AUD equivalent shown alongside in notifications.
- [x] ~~`previousLowest` excludes URLs that failed to extract~~ — `checkPrices` now pushes a `success: false` row for scrape failures, populated with the URL's stored `previous_*` fields. `previousLowestFor` extracted to `notifications/aggregate.ts` (pure module, no DB import) and unit-tested with a regression case that fails on the old code path.
- [ ] **Add `CHECK` (or service-layer validation) for `notifications.kind`** — column was added via `ALTER`, so no CHECK exists. `'alert' | 'recovery' | 'test'` is enforced only by TypeScript.
- [ ] **Symmetric validation for `status`** — `notify_kind` is validated in the service layer; `status` relies only on the SQLite CHECK constraint. Pick one place and do both there.
- [ ] **Remove `as any` in `web/src/App.tsx:400`** — `scanArbitraryUrl` should return a discriminated union so the error path narrows naturally.

## Features

- [x] ~~Price history chart in the web UI~~ — new `getProductPriceHistory()` in core + `GET /api/products/:id/price-history` + `<PriceHistoryChart>` (recharts) rendered inside the expanded product row. Y-axis is AUD; tooltip shows native amount alongside; one line per URL.
- [x] ~~Stock-status alerts~~ — added `back_in_stock` and `out_of_stock` notify kinds end-to-end: product validation, evaluator cases (alongside the existing four price kinds), separate `decide` branch (stock transitions are discrete events with no re-alert dedupe), `currentlyInStock` / `previouslyInStock` plumbed through `PriceCheckAggregatedData`, new formatter messages, web dropdown options. 17 new evaluator tests covering every transition; suite now at 48 green.
- [ ] **Daily / weekly digest mode** — one Telegram summary at 8am instead of (or alongside) per-product alerts. Reuses `getProductPriceSummary`.
- [ ] **Affiliate-link rewriting** — the Amazon Partner Tag is already configured. Append `?tag=...` to Amazon URLs in outbound notifications. Trivial; monetises the tracker.
- [ ] **Tags / categories** on products with filters in the table.
- [ ] **Per-URL notify rules** — useful when one retailer is the benchmark and the others are noise.
- [ ] **Browser extension / bookmarklet** to add a URL to an existing product in one click.
- [ ] **Coupon / promo-code surfacing** for sites that publish them in JSON-LD or page metadata.
- [ ] **Additional notifier channels** — Discord webhook is ~50 lines via the existing `Adapter` interface; email via Resend or SES is similar.
- [ ] **Auto-discover product URLs** across retailers via UPC / GTIN matching from JSON-LD.

## Optimisations

- [x] ~~Tests for `notifications/evaluator`~~ — 31 tests covering all four `evaluateRule` kinds (edges + boundary semantics) and every transition in the `decide` state machine. Vitest is now wired up at the core package; run with `pnpm --filter @spawncamper/core test`.
- [x] ~~Move the cron out of the API process~~ — new `packages/scheduler` owns the timer; the API keeps the manual-trigger endpoint and reads status from the DB. Both processes call shared `runPriceCheck()` in core.
- [x] ~~Persist cron run history~~ — new `cron_runs` table with a unique partial index on `status='running'` for race-safe single-runner semantics across processes. Status endpoint and manual trigger now survive restarts.
- [ ] **Retry + exponential backoff** on transient scraper failures (network, 5xx, captcha). Today a single failed fetch yields `null` and leaves no record.
- [ ] **Log scrape failures distinctly from out-of-stock** — `price_check_failures` table or nullable rows. Without this it's hard to spot which retailers need their selectors updated.
- [x] ~~Enable `PRAGMA journal_mode = WAL`~~ — already on in `core/src/db/db.ts`.
- [ ] **Versioned migrations** — bootstrap-on-boot + try/catch ALTERs works but won't scale. `schema_version` table + ordered migration files.
- [ ] **Structured logging (pino)** with levels — `console.log/error` scattered through `core` makes it hard to silence noisy categories without losing real errors.
- [ ] **Per-domain concurrency in `checkAllProducts`** — current loop is fully sequential with 5–10s gaps. URLs across different domains can run in parallel; only same-domain needs to serialise. Per-domain semaphore would cut wall time substantially.
