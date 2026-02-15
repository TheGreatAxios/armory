/**
 * Simple Middleware API Tests
 * Tests the simplified payment middleware with chain/token string support
 */
import { test, expect, describe } from "bun:test";
import { Hono } from "hono";
import { paymentMiddleware, createPaymentRequirements } from "../src/simple";

describe("[unit|middleware-hono]: PaymentConfig Resolution", () => {
  test("[resolvePayTo|success] - resolves global payTo when no overrides exist", () => {
    const result = createPaymentRequirements({
      payTo: "0x1111111111111111111111111111111111111111",
      chain: "base",
      token: "usdc",
    });

    expect(result.error).toBeUndefined();
    expect(result.requirements[0].payTo).toBe("0x1111111111111111111111111111111111111111");
  });

  test("[resolvePayTo|success] - resolves per-chain payTo override", () => {
    const result = createPaymentRequirements({
      payTo: "0x1111111111111111111111111111111111111111",
      payToByChain: {
        base: "0x2222222222222222222222222222222222222222",
      },
      chain: "base",
      token: "usdc",
    });

    expect(result.error).toBeUndefined();
    expect(result.requirements[0].payTo).toBe("0x2222222222222222222222222222222222222222");
  });

  test("[resolvePayTo|success] - resolves per-token-per-chain payTo override", () => {
    const result = createPaymentRequirements({
      payTo: "0x1111111111111111111111111111111111111111",
      payToByToken: {
        base: {
          usdc: "0x3333333333333333333333333333333333333333",
        },
      },
      chain: "base",
      token: "usdc",
    });

    expect(result.error).toBeUndefined();
    expect(result.requirements[0].payTo).toBe("0x3333333333333333333333333333333333333333");
  });

  test("[resolvePayTo|success] - falls back to per-chain when token-specific not found", () => {
    const result = createPaymentRequirements({
      payTo: "0x1111111111111111111111111111111111111111",
      payToByChain: {
        base: "0x2222222222222222222222222222222222222222",
      },
      payToByToken: {
        "base-sepolia": {
          usdc: "0x3333333333333333333333333333333333333333",
        },
      },
      chain: "base",
      token: "usdc",
    });

    expect(result.error).toBeUndefined();
    expect(result.requirements[0].payTo).toBe("0x2222222222222222222222222222222222222222");
  });

  test("[resolvePayTo|success] - falls back to global when chain-specific not found", () => {
    const result = createPaymentRequirements({
      payTo: "0x1111111111111111111111111111111111111111",
      payToByChain: {
        "base-sepolia": "0x2222222222222222222222222222222222222222",
      },
      chain: "base",
      token: "usdc",
    });

    expect(result.error).toBeUndefined();
    expect(result.requirements[0].payTo).toBe("0x1111111111111111111111111111111111111111");
  });

  test("[resolvePayTo|success] - handles multiple chains with different payTo addresses", () => {
    const baseResult = createPaymentRequirements({
      payTo: "0x1111111111111111111111111111111111111111",
      payToByChain: {
        base: "0x2222222222222222222222222222222222222222",
      },
      chain: "base",
      token: "usdc",
    });

    const skaleResult = createPaymentRequirements({
      payTo: "0x1111111111111111111111111111111111111111",
      payToByChain: {
        "skale-base": "0x3333333333333333333333333333333333333333",
      },
      chain: "skale-base",
      token: "usdt",
    });

    expect(baseResult.error).toBeUndefined();
    expect(skaleResult.error).toBeUndefined();

    expect(baseResult.requirements[0].payTo).toBe("0x2222222222222222222222222222222222222222");
    expect(skaleResult.requirements[0].payTo).toBe("0x3333333333333333333333333333333333333333");
  });

  test("[resolveFacilitatorUrl|success] - resolves facilitatorUrl with same priority", () => {
    const result = createPaymentRequirements({
      payTo: "0x1111111111111111111111111111111111111111",
      facilitatorUrl: "https://global.facilitator.com",
      chain: "base",
      token: "usdc",
    });

    expect(result.error).toBeUndefined();
    expect(result.requirements[0].extra?.facilitatorUrl).toBe("https://global.facilitator.com");
  });

  test("[resolveFacilitatorUrl|success] - resolves per-chain facilitatorUrl override", () => {
    const result = createPaymentRequirements({
      payTo: "0x1111111111111111111111111111111111111111",
      facilitatorUrlByChain: {
        base: "https://base.facilitator.com",
      },
      chain: "base",
      token: "usdc",
    });

    expect(result.error).toBeUndefined();
    expect(result.requirements[0].extra?.facilitatorUrl).toBe("https://base.facilitator.com");
  });

  test("[resolveFacilitatorUrl|success] - resolves per-token-per-chain facilitatorUrl override", () => {
    const result = createPaymentRequirements({
      payTo: "0x1111111111111111111111111111111111111111",
      facilitatorUrlByToken: {
        base: {
          usdc: "https://base-usdc.facilitator.com",
        },
      },
      chain: "base",
      token: "usdc",
    });

    expect(result.error).toBeUndefined();
    expect(result.requirements[0].extra?.facilitatorUrl).toBe("https://base-usdc.facilitator.com");
  });

  test("[resolveFacilitatorUrl|success] - combines payTo and facilitatorUrl overrides", () => {
    const result = createPaymentRequirements({
      payTo: "0x1111111111111111111111111111111111111111",
      payToByChain: {
        base: "0x2222222222222222222222222222222222222222",
      },
      facilitatorUrlByToken: {
        base: {
          usdc: "https://base-usdc.facilitator.com",
        },
      },
      chain: "base",
      token: "usdc",
    });

    expect(result.error).toBeUndefined();
    expect(result.requirements[0].payTo).toBe("0x2222222222222222222222222222222222222222");
    expect(result.requirements[0].extra?.facilitatorUrl).toBe("https://base-usdc.facilitator.com");
  });
});

describe("[unit|middleware-hono]: Simple Middleware API", () => {
  test("creates requirements with name and version for USDC on Base", () => {
    const result = createPaymentRequirements({
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
    const result = createPaymentRequirements({
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
    const result = createPaymentRequirements({
      payTo: "0x1234567890123456789012345678901234567890",
      chains: ["base", "skale-base"],
      tokens: ["usdc"],
    });

    expect(result.error).toBeUndefined();
    expect(result.requirements.length).toBeGreaterThanOrEqual(1);
  });

  test("middleware returns 402 when no payment header", async () => {
    const app = new Hono();
    app.use("/*", paymentMiddleware({
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
    const result = createPaymentRequirements({
      payTo: "0x1234567890123456789012345678901234567890",
      chain: "base",
    });

    expect(result.error).toBeUndefined();
    expect(result.requirements[0].amount).toBe("1000000");
  });
});
