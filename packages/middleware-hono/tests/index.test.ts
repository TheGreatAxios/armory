/**
 * Hono Middleware Integration Tests
 * Tests full middleware flow including:
 * - 402 response when no payment header provided
 * - Error handling for invalid payloads
 */
import { test, expect, describe } from "bun:test";
import { Hono } from "hono";
import { paymentMiddleware } from "../src/index";
import { DEFAULT_PAYMENT_CONFIG } from "@armory-sh/base";

describe("[unit|middleware-hono]: Hono Middleware Integration", () => {
  test("returns 402 when no payment header provided", async () => {
    const app = new Hono();
    app.use("/*", paymentMiddleware({ requirements: DEFAULT_PAYMENT_CONFIG }));
    app.get("/api/test", (c) => c.json({ success: true }));

    const req = new Request(new URL("http://localhost/api/test"));
    const res = await app.fetch(req);

    expect(res.status).toBe(402);
  });

  test("returns 402 when no payment header provided", async () => {
    const app = new Hono();
    app.use("/*", paymentMiddleware({ requirements: DEFAULT_PAYMENT_CONFIG }));
    app.get("/api/test", (c) => c.json({ success: true }));

    const req = new Request(new URL("http://localhost/api/test"));
    const res = await app.fetch(req);

    expect(res.status).toBe(402);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });

  test("returns 400 with invalid payment payload", async () => {
    const app = new Hono();
    app.use("/*", paymentMiddleware({ requirements: DEFAULT_PAYMENT_CONFIG }));
    app.get("/api/test", (c) => c.json({ success: true }));

    const req = new Request(new URL("http://localhost/api/test"), {
      headers: {
        "PAYMENT-SIGNATURE": "invalid-base64-payload",
      },
    });
    const res = await app.fetch(req);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });

  test("returns 402 with empty payment header", async () => {
    const app = new Hono();
    app.use("/*", paymentMiddleware({ requirements: DEFAULT_PAYMENT_CONFIG }));
    app.get("/api/test", (c) => c.json({ success: true }));

    const req = new Request(new URL("http://localhost/api/test"));
    const res = await app.fetch(req);

    expect(res.status).toBe(402);
  });
});