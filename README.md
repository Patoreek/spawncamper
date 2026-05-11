# Spawncamper

Product price tracker. Monitor prices across retailers, get notified when they drop.

## Quick Start

```bash
pnpm install
pnpm -r build              # build everything once
```

Run the API, scheduler and web frontend (three terminals — or just `pnpm dev` from the root to start all in parallel):

```bash
pnpm --filter @spawncamper/api dev          # API on :3001
pnpm --filter @spawncamper/scheduler dev    # Nightly price-check timer
pnpm --filter web dev                       # Web UI on :5173
```

Other packages:

```bash
pnpm --filter @spawncamper/core dev             # run core dev script / migration
```

## Environment Variables

Copy `.env.example` or create `.env` in the project root:

```bash
# Database (SQLite) — relative paths anchor to the workspace root, so the
# API and scheduler open the same file. Absolute paths are used as-is.
SPAWNCAMPER_DB='spawncamper.db'

# Amazon Product Advertising API (PA-API v5)
AMAZON_ACCESS_KEY=''
AMAZON_SECRET_KEY=''
AMAZON_PARTNER_TAG=''

# ScraperAPI — proxy for heavily protected sites
SCRAPER_API_KEY=''

# Telegram notifications (both required to send messages)
TELEGRAM_BOT_TOKEN=''
TELEGRAM_CHAT_ID=''
```

### Amazon PA-API Setup

The PA-API is used to fetch prices from Amazon product pages. Without it, Amazon URLs will return `null`.

1. Sign up for [Amazon Associates](https://affiliate-program.amazon.com) (free)
2. Once approved, go to **Tools → Product Advertising API** in the Associates dashboard
3. Click **Manage Your Credentials** to generate an Access Key and Secret Key
4. Your Partner Tag is your Associates tracking ID (e.g. `mystore-20`)
5. Add all three values to `.env`

Supports all Amazon regional domains (`.com`, `.co.uk`, `.com.au`, `.de`, `.co.jp`, etc.).

The `AMAZON_PARTNER_TAG` value is also appended as a `?tag=` parameter to any Amazon URL surfaced in outbound Telegram notifications. Non-Amazon URLs and links displayed in the web UI are left untouched.

### ScraperAPI Setup

Used for sites with aggressive bot protection (Big W, eBay, Best Buy, Walmart, Costco). These sites use CDN-level TLS fingerprinting that blocks direct requests and headless browsers.

1. Sign up at [ScraperAPI](https://www.scraperapi.com) (free tier: 5,000 requests/month)
2. Copy your API key from the dashboard
3. Add it to `.env` as `SCRAPER_API_KEY`

ScraperAPI handles IP rotation, CAPTCHA solving, and JS rendering — you get back fully rendered HTML.

### Telegram Setup

Used to deliver price-drop and recovery notifications. If either variable is unset, sends are skipped with a console warning.

1. Message [@BotFather](https://t.me/BotFather) on Telegram and run `/newbot` to create a bot — copy the token it gives you into `TELEGRAM_BOT_TOKEN`.
2. DM your new bot once (so it can message you back), then open `https://api.telegram.org/bot<TOKEN>/getUpdates` in a browser and copy the `chat.id` from the response into `TELEGRAM_CHAT_ID`.

### Playwright Setup

Playwright is used for JS-rendered sites without aggressive bot detection (Target, Officeworks). Install the browser binary once:

```bash
cd packages/core && npx playwright install chromium
```

## Packages

| Package | Description | Port |
|---------|-------------|------|
| `packages/core` | Shared domain logic — products, URLs, price checks, scraping | — |
| `packages/api` | Hono REST API exposing core CRUD operations | 3001 |
| `packages/scheduler` | Nightly cron process that triggers `checkAllProducts` | — |
| `packages/web` | React + Vite frontend for managing products & URLs | 5173 |
| `packages/messenger` | Generic messenger abstraction with Telegram + mock adapters | — |

## Price Extraction Strategies

URLs are routed to different extraction strategies based on the domain:

| Domain | Strategy | Requires |
|--------|----------|----------|
| `amazon.*` | PA-API v5 | `AMAZON_*` env vars |
| `bigw`, `ebay`, `bestbuy`, `walmart`, `costco` | Proxy (ScraperAPI) | `SCRAPER_API_KEY` |
| `target`, `officeworks` | Playwright | Chromium binary |
| Everything else | Cheerio | Nothing |

**Cheerio** works best with sites that serve JSON-LD structured data (Shopify stores, Apple, Rebel Sport, JB Hi-Fi, Kogan, Nike, ASOS, etc.).
