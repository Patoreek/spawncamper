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
  createProductUrl,
  getProductUrlsForProduct,
  getAllProductUrls,
  pauseProductUrl,
  deleteProductUrl,
} from '@spawncamper/core';

const app = new Hono();

app.use('/*', cors());

app.onError((err, c) => {
  const message = err instanceof Error ? err.message : 'Internal server error';
  return c.json({ success: false, error: { code: 'SERVER_ERROR', message } }, 500);
});

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

const port = 3001;
console.log(`API server running on http://localhost:${port}`);
serve({ fetch: app.fetch, port });
