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
- [x] ~~Daily / weekly digest mode~~ — new `core/src/digest/` module (`buildDigest` / `sendDigest` / `formatDigest`). One Telegram summary across every active product: name, current lowest AUD + retailer, % movement since initial, OOS flag. Rows sorted by biggest discount first; no-data rows fall to the bottom alphabetically. Opt-in via `DIGEST_CRON` + `DIGEST_TZ` env vars on the scheduler — unset = disabled. Manual `POST /api/digest/send` (with `?dry_run=true` for previewing layout). Deliberately does *not* write to `notifications` so it stays out of the alert state machine (no dedupe needed for a recurring summary, no new `notify_kind` to validate). 10 new formatter tests covering empty/single/multi/drop/rise/no-change/OOS/no-data/no-URLs/sorting; suite at 90.
- [x] ~~Affiliate-link rewriting~~ — new pure `core/src/affiliate/service.ts` exports `withAffiliateTag(url, tag?)` (env-default, no-op on non-Amazon hosts or unparseable URLs). `renderUrlList` now wraps each retailer name in a Markdown link to the tagged URL, so alerts gain clickable links *and* monetisation in one change. 8 tests covering empty tag, non-Amazon, substring false-positives, append/replace, query preservation, and unparseable input.
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
- [x] ~~Retry + exponential backoff~~ — new `core/src/utils/retry.ts` exports a generic `retryNull(fn, {maxAttempts, backoffMs, sleep?})` (sleep is injectable for tests). `checkPrices` and `checkSingleUrl` now use it via a local `scrapeWithRetry` (3 attempts, ~500ms→1000ms exponential backoff with jitter). `/api/scan-url` deliberately stays single-attempt for fast manual debugging. Failure log message now records the attempt count (`"failed after 3 attempts"`). 8 new utility tests; suite at 68.
- [x] ~~Extractor reason-code refactor~~ — all four extractors (cheerio, proxy, playwright, amazon) now return a discriminated-union `ExtractResult` (`{ok: true, data}` or `{ok: false, reason, retryable, message}`). `retry` utility generalised to take a predicate. `scrapeWithRetry` retries iff `!ok && retryable`. `recordScrapeFailure` now logs the specific reason (`network_error` / `http_error` / `no_price_found` / `config_missing` / `item_unavailable` / `parse_error`) instead of the generic `extraction_failed`. `/api/scan-url` error envelope exposes `reason` + `retryable`. Concrete win: a 404 short-circuits in ~80ms instead of burning 1.5s on retries; verified live.
- [x] ~~Log scrape failures distinctly from out-of-stock~~ — new `price_check_failures` table + `core/src/price_check_failures/` module (DAL + service). `checkPrices` and `checkSingleUrl` call `recordScrapeFailure` with specific reason codes (after the extractor refactor). API endpoints: `/api/product-urls/:id/failures`, `/api/product-urls/:id/failure-summary`, `/api/products/:id/url-failure-summaries` (batch for the UI). Web shows a ⚠ badge inline with the retailer name when `failures_last_24h > 0`, with a hover tooltip giving the count and latest timestamp.
- [x] ~~Enable `PRAGMA journal_mode = WAL`~~ — already on in `core/src/db/db.ts`.
- [ ] **Versioned migrations** — bootstrap-on-boot + try/catch ALTERs works but won't scale. `schema_version` table + ordered migration files.
- [ ] **Structured logging (pino)** with levels — `console.log/error` scattered through `core` makes it hard to silence noisy categories without losing real errors.
- [x] ~~Per-domain concurrency in `checkAllProducts`~~ — new `core/src/utils/domain_scheduler.ts` (`DomainScheduler` class). All URLs across all products now go through one shared scheduler: different hostnames run truly concurrent; same hostname queues with a 3000ms+jitter min-gap. `checkPrices` parallelises URLs via `Promise.all`; `checkAllProducts` parallelises products the same way. Removed the old serial inter-URL and inter-product sleeps. **Live measurement**: 4 URLs across 2 products with distinct hostnames dropped from ~22s expected serial → 1.86s actual (~12× faster). Same-hostname pair still serialises at ~6.6s. 9 unit tests covering same-domain serialisation, cross-domain parallelism, gap enforcement, and failure isolation.
