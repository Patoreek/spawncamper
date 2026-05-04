import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { checkPrice } from "@spawncamper/core";

const app = new Hono();
app.get("/price", async (c) => {
  const url = c.req.query("url");
  if (!url) return c.json({ error: "url required" }, 400);
  return c.json(await checkPrice([url]));
});

serve({ fetch: app.fetch, port: 4000 });