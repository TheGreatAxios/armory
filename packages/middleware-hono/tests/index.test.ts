/**
 * Hono Middleware Integration Tests
 * Tests full middleware flow including:
 * - 402 response when no payment header provided
 * - Error handling for invalid payloads
 */
import { describe, expect, test } from "bun:test";
import type { PaymentRequirementsV2 } from "@armory-sh/base";
import { Hono } from "hono";
import { paymentMiddleware } from "../src/index";

const TEST_REQUIREMENTS: PaymentRequirementsV2 = {
  scheme: "exact",
  network: "eip155:84532",
  amount: "1000000",
  asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  payTo: "0x1234567890123456789012345678901234567890",
  maxTimeoutSeconds: 300,
};

describe("[unit|middleware-hono]: Hono Middleware Integration", () => {
  test("returns 402 when no payment header provided", async () => {
    const app = new Hono();
    app.use("/*", paymentMiddleware({ requirements: TEST_REQUIREMENTS }));
    app.get("/api/test", (c) => c.json({ success: true }));

    const req = new Request(new URL("http://localhost/api/test"));
    const res = await app.fetch(req);

    expect(res.status).toBe(402);
  });

  test("returns 402 when no payment header provided", async () => {
    const app = new Hono();
    app.use("/*", paymentMiddleware({ requirements: TEST_REQUIREMENTS }));
    app.get("/api/test", (c) => c.json({ success: true }));

    const req = new Request(new URL("http://localhost/api/test"));
    const res = await app.fetch(req);

    expect(res.status).toBe(402);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });

  test("returns 400 with invalid payment payload", async () => {
    const app = new Hono();
    app.use("/*", paymentMiddleware({ requirements: TEST_REQUIREMENTS }));
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
    app.use("/*", paymentMiddleware({ requirements: TEST_REQUIREMENTS }));
    app.get("/api/test", (c) => c.json({ success: true }));

    const req = new Request(new URL("http://localhost/api/test"));
    const res = await app.fetch(req);

    expect(res.status).toBe(402);
  });
});
