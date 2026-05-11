import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import cron from 'node-cron';
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
  checkAllProducts,
  getDataFromUrl,
  getLatestPriceChecksForProduct,
  getAllPreviousPriceChecks,
  getProductPriceSummary,
  sendTestMessage,
  clearNotificationsFor,
} from '@spawncamper/core';

const app = new Hono();

app.use('/*', cors());

app.onError((err, c) => {
  const message = err instanceof Error ? err.message : 'Internal server error';
  return c.json({ success: false, error: { code: 'SERVER_ERROR', message } }, 500);
});

// ── Cron State ─────────────────────────────────────────

const cronState = {
  isRunning: false,
  lastRunAt: null as string | null,
  lastRunStatus: null as 'success' | 'error' | null,
  lastRunError: null as string | null,
  productsChecked: 0,
  urlsChecked: 0,
};

async function runScheduledCheck() {
  if (cronState.isRunning) {
    console.log('[cron] Skipping — previous run still in progress');
    return;
  }

  cronState.isRunning = true;
  console.log(`[cron] Starting scheduled price check at ${new Date().toISOString()}`);

  try {
    const result = await checkAllProducts();
    cronState.lastRunAt = result.completedAt;
    cronState.lastRunStatus = 'success';
    cronState.lastRunError = null;
    cronState.productsChecked = result.productsChecked;
    cronState.urlsChecked = result.urlsChecked;
    console.log(`[cron] Completed: ${result.productsChecked} products, ${result.urlsChecked} URLs checked`);
  } catch (err) {
    cronState.lastRunAt = new Date().toISOString();
    cronState.lastRunStatus = 'error';
    cronState.lastRunError = err instanceof Error ? err.message : 'Unknown error';
    console.error('[cron] Failed:', err);
  } finally {
    cronState.isRunning = false;
  }
}

// Schedule: 8:30pm every night Sydney time
const cronJob = cron.schedule('30 20 * * *', runScheduledCheck, {
  timezone: 'Australia/Sydney',
});

console.log('[cron] Scheduled daily price check at 20:30 Australia/Sydney');

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

// Get cron status
app.get('/api/cron/status', (c) => {
  return c.json({
    schedule: '20:30 daily (Australia/Sydney)',
    ...cronState,
  });
});

// Trigger manual run (fire-and-forget, returns immediately)
app.post('/api/cron/run', (c) => {
  if (cronState.isRunning) {
    return c.json({ success: false, error: { code: 'ALREADY_RUNNING', message: 'A price check is already in progress' } }, 409);
  }

  // Fire and forget — don't await
  runScheduledCheck();

  return c.json({ success: true, message: 'Price check started' });
});

const port = 3001;
console.log(`API server running on http://localhost:${port}`);
serve({ fetch: app.fetch, port });
