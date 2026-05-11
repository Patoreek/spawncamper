import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import {
  createProduct,
  getAllProducts,
  pauseProduct,
  activateProduct,
  archiveProduct,
  deleteProduct,
  updateNotifyRule,
  createProductUrl,
  getProductUrlById,
  getProductUrlsForProduct,
  getAllProductUrls,
  pauseProductUrl,
  deleteProductUrl,
  checkPrices,
  checkSingleUrl,
  getDataFromUrl,
  getLatestPriceChecksForProduct,
  getAllPreviousPriceChecks,
  getProductPriceSummary,
  getProductPriceHistory,
  sendTestMessage,
  clearNotificationsFor,
  runPriceCheck,
  sweepStaleRunning,
  getCronStatus,
} from '@spawncamper/core';

const app = new Hono();

app.use('/*', cors());

app.onError((err, c) => {
  const message = err instanceof Error ? err.message : 'Internal server error';
  return c.json({ success: false, error: { code: 'SERVER_ERROR', message } }, 500);
});

// Sweep any 'running' rows left over from a crashed/killed previous run so the
// status panel doesn't report a phantom in-flight check.
sweepStaleRunning();

// Schedule string is owned by `@spawncamper/scheduler`; mirrored here purely
// for display in the status panel. Keep in sync if the scheduler changes.
const SCHEDULE_DESCRIPTION = '20:30 daily (Australia/Sydney)';

// ── Products ────────────────────────────────────────────

app.get('/api/products', (c) => {
  const status = c.req.query('status') ?? null;
  return c.json(getAllProducts(status));
});

app.post('/api/products', async (c) => {
  const body = await c.req.json();
  const product = createProduct(body);
  return c.json(product, 201);
});

app.patch('/api/products/:id/pause', (c) => {
  const id = Number(c.req.param('id'));
  return c.json(pauseProduct(id));
});

app.patch('/api/products/:id/activate', (c) => {
  const id = Number(c.req.param('id'));
  return c.json(activateProduct(id));
});

app.patch('/api/products/:id/archive', (c) => {
  const id = Number(c.req.param('id'));
  return c.json(archiveProduct(id));
});

app.delete('/api/products/:id', (c) => {
  const id = Number(c.req.param('id'));
  return c.json(deleteProduct(id));
});

// ── Notifications ───────────────────────────────────────

app.patch('/api/products/:id/notify-rule', async (c) => {
  const id = Number(c.req.param('id'));
  const body = await c.req.json();
  try {
    const updated = updateNotifyRule(id, {
      enabled: !!body.enabled,
      kind: body.kind ?? null,
      value: body.value === undefined || body.value === null || body.value === '' ? null : Number(body.value),
    });
    if (!updated) {
      return c.json({ success: false, error: { code: 'PRODUCT_NOT_FOUND', message: `No product with id ${id}` } }, 404);
    }
    // Rule changed — clear stale alert/recovery state so the new rule starts fresh.
    clearNotificationsFor(id);
    return c.json(updated);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Invalid rule';
    return c.json({ success: false, error: { code: 'INVALID_RULE', message } }, 400);
  }
});

app.post('/api/products/:id/notify-test', async (c) => {
  const id = Number(c.req.param('id'));
  const result = await sendTestMessage(id);
  if (result.sent) return c.json({ success: true, message: 'Test message sent' });
  return c.json(
    { success: false, error: { code: 'NOT_SENT', message: result.skippedReason ?? 'Message not sent' } },
    result.skippedReason === 'product_not_found' ? 404 : 503,
  );
});

// ── Product URLs ────────────────────────────────────────

app.get('/api/products/:id/urls', (c) => {
  const productId = Number(c.req.param('id'));
  return c.json(getProductUrlsForProduct(productId));
});

app.post('/api/products/:id/urls', async (c) => {
  const productId = Number(c.req.param('id'));
  const body = await c.req.json();
  const url = createProductUrl({ ...body, product_id: productId });
  return c.json(url, 201);
});

app.get('/api/product-urls', (c) => {
  const active = c.req.query('active');
  const filter = active === undefined ? null : active === 'true';
  return c.json(getAllProductUrls(filter));
});

app.patch('/api/product-urls/:id/pause', (c) => {
  const id = Number(c.req.param('id'));
  return c.json(pauseProductUrl(id));
});

app.delete('/api/product-urls/:id', (c) => {
  const id = Number(c.req.param('id'));
  return c.json(deleteProductUrl(id));
});

// ── Price Checks ────────────────────────────────────────

// Get latest price checks for a product (most recent per URL)
app.get('/api/products/:id/latest-prices', (c) => {
  const productId = Number(c.req.param('id'));
  return c.json(getLatestPriceChecksForProduct(productId));
});

// Get price summary for a product (initial, lowest, % decrease)
app.get('/api/products/:id/price-summary', (c) => {
  const productId = Number(c.req.param('id'));
  return c.json(getProductPriceSummary(productId));
});

// Get full price history across all URLs (flat array of {product_url_id, retailer, price, price_aud, ...})
app.get('/api/products/:id/price-history', (c) => {
  const productId = Number(c.req.param('id'));
  return c.json(getProductPriceHistory(productId));
});

// Get price history for a specific URL
app.get('/api/product-urls/:id/price-history', (c) => {
  const id = Number(c.req.param('id'));
  return c.json(getAllPreviousPriceChecks(id));
});

// Check prices for a single product (synchronous — waits for result)
app.post('/api/products/:id/check-prices', async (c) => {
  const productId = Number(c.req.param('id'));
  const result = await checkPrices(productId);
  return c.json(result);
});

// Scan a single URL
app.post('/api/product-urls/:id/scan', async (c) => {
  const id = Number(c.req.param('id'));
  const productUrl = getProductUrlById(id);
  if (!productUrl) {
    return c.json({ success: false, error: { code: 'NOT_FOUND', message: `Product URL with id ${id} not found` } }, 404);
  }

  try {
    const result = await checkSingleUrl(id);
    if (!result) {
      return c.json({ success: false, error: { code: 'SCAN_FAILED', message: `Could not extract price data from ${productUrl.retailer} (${productUrl.url})` } }, 422);
    }
    return c.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error during scan';
    return c.json({ success: false, error: { code: 'SCAN_ERROR', message } }, 500);
  }
});

// Scan an arbitrary URL (not saved in DB)
app.post('/api/scan-url', async (c) => {
  const body = await c.req.json();
  const url = body.url;
  if (!url) {
    return c.json({ success: false, error: { code: 'BAD_REQUEST', message: 'url is required' } }, 400);
  }
  const result = await getDataFromUrl(url);
  if (!result) {
    return c.json({ success: false, error: { code: 'SCAN_FAILED', message: 'Could not extract price data from URL' } }, 422);
  }
  return c.json(result);
});

// ── Cron Control ────────────────────────────────────────

// Get cron status (reads from `cron_runs`; survives API restarts)
app.get('/api/cron/status', (c) => {
  return c.json({
    schedule: SCHEDULE_DESCRIPTION,
    ...getCronStatus(),
  });
});

// Trigger manual run (fire-and-forget, returns immediately).
// The unique partial index on cron_runs guarantees only one run is in flight
// at any time across both the API and scheduler processes.
app.post('/api/cron/run', (c) => {
  if (getCronStatus().isRunning) {
    return c.json({ success: false, error: { code: 'ALREADY_RUNNING', message: 'A price check is already in progress' } }, 409);
  }

  // Fire and forget. If a race squeezes in between the gate above and the
  // INSERT inside runPriceCheck, the unique index rejects it and we just log.
  runPriceCheck('manual')
    .then((result) => {
      if (!result.ok && result.reason === 'already_running') {
        console.log('[cron] manual trigger lost the race to another run');
      }
    })
    .catch((err) => console.error('[cron] manual run threw unexpectedly:', err));

  return c.json({ success: true, message: 'Price check started' });
});

const port = 3001;
console.log(`API server running on http://localhost:${port}`);
serve({ fetch: app.fetch, port });
