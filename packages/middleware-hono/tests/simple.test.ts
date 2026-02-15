/**
 * Simple Middleware API Tests
 * Tests the simplified payment middleware with chain/token string support
 */
import { test, expect, describe } from "bun:test";
import { Hono } from "hono";
import { simplePaymentMiddleware, createSimpleRequirements } from "../src/simple";

describe("[unit|middleware-hono]: Simple Middleware API", () => {
  test("creates requirements with name and version for USDC on Base", () => {
    const result = createSimpleRequirements({
      payTo: "0x1234567890123456789012345678901234567890",
      chain: "base",
      token: "usdc",
      amount: "1.0",
    });

    expect(result.error).toBeUndefined();
    expect(result.requirements).toHaveLength(1);

    const req = result.requirements[0];
    expect(req.scheme).toBe("exact");
    expect(req.network).toBe("eip155:8453");
    expect(req.asset).toBe("0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913");
    expect(req.amount).toBe("1000000");
    expect(req.extra?.name).toBe("USD Coin");
    expect(req.extra?.version).toBe("2");
  });

  test("creates requirements for SKALE Base with USDC", () => {
    const result = createSimpleRequirements({
      payTo: "0x1234567890123456789012345678901234567890",
      chain: "skale-base",
      token: "usdc",
    });

    expect(result.error).toBeUndefined();
    expect(result.requirements).toHaveLength(1);

    const req = result.requirements[0];
    expect(req.network).toBe("eip155:1187947933");
    expect(req.extra?.name).toBe("USD Coin");
    expect(req.extra?.version).toBe("2");
  });

  test("creates requirements for multiple chains and tokens", () => {
    const result = createSimpleRequirements({
      payTo: "0x1234567890123456789012345678901234567890",
      chains: ["base", "skale-base"],
      tokens: ["usdc"],
    });

    expect(result.error).toBeUndefined();
    expect(result.requirements.length).toBeGreaterThanOrEqual(1);
  });

  test("middleware returns 402 when no payment header", async () => {
    const app = new Hono();
    app.use("/*", simplePaymentMiddleware({
      payTo: "0x1234567890123456789012345678901234567890",
      chain: "base",
      token: "usdc",
    }));
    app.get("/api/test", (c) => c.json({ success: true }));

    const req = new Request(new URL("http://localhost/api/test"));
    const res = await app.fetch(req);

    expect(res.status).toBe(402);
    const body = await res.json();
    expect(body.error).toBeDefined();
    expect(body.accepts).toBeDefined();
    expect(body.accepts[0].extra?.name).toBe("USD Coin");
    expect(body.accepts[0].extra?.version).toBe("2");
  });

  test("uses default amount when not specified", () => {
    const result = createSimpleRequirements({
      payTo: "0x1234567890123456789012345678901234567890",
      chain: "base",
    });

    expect(result.error).toBeUndefined();
    expect(result.requirements[0].amount).toBe("1000000");
  });
});
