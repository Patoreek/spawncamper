# Spawncamper — Outstanding Enhancements

Snapshot as of 2026-05-11. Everything checked off in `TODO.md` is omitted here. Items are grouped and ranked roughly by leverage / effort, with subtle decisions noted inline so future-you doesn't have to re-derive them.

## Bugs / cleanup

Small surgical items. Combined effort: ~30 min.

- [ ] **`notifications.kind` validation** — column was added via `ALTER`, so SQLite has no `CHECK` constraint. Today `'alert' | 'recovery' | 'test'` is enforced only by TypeScript. Mirror the pattern used by `updateNotifyRule` in `products/service.ts` and validate in the service layer where the value originates. Don't try to add a `CHECK` retroactively — that requires a table rebuild, which only makes sense as part of the versioned-migrations work below.

- [ ] **Symmetric `status` validation** — `notify_kind` validates in the service layer, `status` relies only on the SQLite `CHECK`. The asymmetry is the bug, not which side is "right". Pick one place and put both there. Service-layer is the more readable choice if you're not doing the migrations work first.

- [ ] **Remove `as any` in `web/src/App.tsx:400`** — `scanArbitraryUrl` should return a discriminated union (`{ ok: true; data } | { ok: false; reason; retryable; message }`) that matches the `/api/scan-url` response shape. The error branch then narrows naturally and the cast drops out.

## Features

Ranked by visible value-per-line of code.

- [ ] **Discord webhook channel** — ~50 lines via the existing `Adapter` interface in `packages/messenger`. Webhook URL via env var (`DISCORD_WEBHOOK_URL`), platform discriminator `'discord'`, JSON body with `content` field. The `Messenger.send()` dispatch already routes by `recipient.platform`, so the digest and per-event alert flows pick this up for free once an adapter + recipient are wired. Email via Resend or SES is the same shape — one more adapter, one more env block.

- [ ] **Per-URL notify rules** — useful when one retailer is the benchmark and the others are noise. Schema: move `notify_*` columns from `products` to a new join table `product_url_notify_rules` (product-level rules become the URL-level default). Touches the evaluator (`previousLowestFor` already iterates URLs; just narrow the candidate set), the API, and the web rule editor. Larger change — pair it with versioned migrations.

- [ ] **Tags / categories** on products with filters in the table. New `tags` table + `product_tags` join. Web filter UI is the real work; the data layer is trivial. Also a good forcing function for versioned migrations.

- [ ] **Browser extension / bookmarklet** to add a URL to an existing product in one click. Bookmarklet is the cheap path (one HTTP POST to a new `/api/quick-add` endpoint with the current page URL + a product picker dropdown). Extension adds a popup but the wire format is the same.

- [ ] **Coupon / promo-code surfacing** — many sites publish coupons in JSON-LD (`Offer.discountCode`) or page metadata. Extract opportunistically inside the existing cheerio path, store on `price_checks` as a nullable column, surface in alerts and the URL list.

- [ ] **Auto-discover product URLs across retailers via UPC / GTIN** — JSON-LD often includes `gtin`/`mpn`/`sku`. If two URLs on the same product agree, you have a key to search other retailers with. Speculative; defer until the manual flow is genuinely a pain point.

## Structural

Pay-it-forward items. No user-visible payoff today, but they unblock the next round of changes.

- [ ] **Versioned migrations** — replace bootstrap-on-boot + try/catch ALTERs with a `schema_version` table + ordered files in `packages/core/src/db/migrations/`. Today's pattern works (4 ALTERs and counting) but every new column adds another silent try/catch. The next non-trivial change — `notifications.kind` `CHECK`, the per-URL notify rules table, or tags — will be the right moment to pull this in.

- [ ] **Structured logging (pino)** with levels — `console.log/error` is scattered across `core`. Hard to silence noisy categories (e.g. the per-domain scheduler chatter) without losing real errors. Replace with a single shared `logger` module that wraps pino; tag log lines with the subsystem (`scheduler`, `digest`, `extractor`, etc.).

## Polish

Small targeted items surfaced during recent work. None are blocking; pick up whenever the surrounding area is being touched.

- [ ] **Failure-table retention purge** — `price_check_failures` grows unbounded. Add a daily delete-where-older-than-N-days job to the scheduler (or hook into the existing nightly tick) once the table actually accumulates volume.

- [ ] **Per-reason breakdown on the failure badge** — today the tooltip shows count + latest timestamp. The infra (`reason` column) is already there; surface a `{ network_error: 3, http_error: 1, ... }` breakdown so a glance at the badge tells you whether to investigate a selector or a flaky retailer.

- [ ] **Web code-split for recharts** — `pnpm --filter web build` currently warns: single chunk at ~592 KB / 166 KB gzip. `PriceHistoryChart` is the only consumer of recharts and is rendered lazily (inside the expanded row), so a dynamic `import()` cleanly separates it.

- [ ] **Native-currency ambiguity in table columns** — non-AUD products show AUD-converted numbers in some places and native in others. Audit `web/src/App.tsx` and pick a consistent convention (e.g. AUD as primary, native in a tooltip / secondary column).

## Picking next

| Want | Pick |
|------|------|
| Highest visible value per LOC | **Discord webhook channel** |
| Smallest, quickest win | **Soft-cleanup trio** (kind validation + status symmetry + `as any`) |
| Unblock future schema work | **Versioned migrations** |
| Biggest UX win | **Tags / categories** (do migrations first) |
