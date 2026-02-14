/**
 * Hono Middleware Integration Tests
 *
 * Tests full middleware flow including:
 * - 402 response when no payment header provided
 * - Error handling for invalid payloads
 */

import { test, expect, describe } from "bun:test";
import { Hono } from "hono";
import { acceptPaymentsViaArmory } from "../src/index";
import { DEFAULT_PAYMENT_CONFIG } from "../../core/src/fixtures/config";

describe("Hono Middleware Integration", () => {
  test("returns 402 when no payment header provided", async () => {
    const app = new Hono();
    app.use("/*", acceptPaymentsViaArmory(DEFAULT_PAYMENT_CONFIG));

    app.get("/api/test", (c) => {
      return c.json({ message: "Success" });
    });

    const req = new Request(new URL("http://localhost/api/test"));
    const res = await app.fetch(req);

    expect(res.status).toBe(402);

    // Check for payment required headers
    const hasPaymentRequired = res.headers.has("PAYMENT-REQUIRED") ||
                            res.headers.has("X-PAYMENT-REQUIRED");

    expect(hasPaymentRequired).toBe(true);
  });

  test("returns 400 with invalid payment payload", async () => {
    const app = new Hono();
    app.use("/*", acceptPaymentsViaArmory(DEFAULT_PAYMENT_CONFIG));

    app.get("/api/test", (c) => {
      return c.json({ message: "Success" });
    });

    const req = new Request(new URL("http://localhost/api/test"), {
      headers: {
        "PAYMENT-SIGNATURE": "invalid-payload",
      },
    });

    const res = await app.fetch(req);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });

  test("returns 402 with empty payment header", async () => {
    const app = new Hono();
    app.use("/*", acceptPaymentsViaArmory(DEFAULT_PAYMENT_CONFIG));

    app.get("/api/test", (c) => {
      return c.json({ message: "Success" });
    });

    const req = new Request(new URL("http://localhost/api/test"), {
      headers: {
        "PAYMENT-SIGNATURE": "",
      },
    });

    const res = await app.fetch(req);

    expect(res.status).toBe(402);

    const hasPaymentRequired = res.headers.has("PAYMENT-REQUIRED") ||
                            res.headers.has("X-PAYMENT-REQUIRED");

    expect(hasPaymentRequired).toBe(true);
  });
});
