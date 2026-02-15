/**
 * Middleware-Express E2E Tests
 *
 * 100% mocked - tests middleware behavior directly
 */

import { describe, test, expect, beforeAll } from "bun:test";
import { paymentMiddleware, type PaymentMiddlewareConfig } from "@armory-sh/middleware-express";
import { TOKENS, registerToken } from "@armory-sh/base";

describe("Middleware-Express E2E", () => {
  beforeAll(() => {
    registerToken(TOKENS.USDC_BASE);
    registerToken(TOKENS.USDC_BASE_SEPOLIA);
  });

  function createMockReq(headers: Record<string, string> = {}) {
    return { headers, method: "GET", url: "/protected" } as any;
  }

  function createMockRes() {
    const headers: Record<string, string> = {};
    const res: any = {
      statusCode: 200,
      json: (data: any) => { res._body = data; },
      setHeader: (k: string, v: string) => { headers[k] = v; },
      get headers() { return headers; },
    };
    return res;
  }

  function runMiddleware(config: PaymentMiddlewareConfig, req: any, res: any) {
    return new Promise<void>((resolve) => {
      const middleware = paymentMiddleware(config);
      const next = () => { resolve(); };
      middleware(req, res, next);
      setTimeout(resolve, 50);
    });
  }

  test("returns 402 when no payment header (V1)", async () => {
    const req = createMockReq();
    const res = createMockRes();

    await runMiddleware({
      requirements: {
        scheme: "exact",
        network: "base-sepolia",
        maxAmountRequired: "1000000",
        asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as `0x${string}`,
        payTo: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as `0x${string}`,
        resource: "http://localhost:3001/protected",
        description: "Test",
        maxTimeoutSeconds: 300,
      },
    }, req, res);

    expect(res.statusCode).toBe(402);
  });

  test("returns 402 when no payment header (V2)", async () => {
    const req = createMockReq();
    const res = createMockRes();

    await runMiddleware({
      requirements: [{
        scheme: "exact",
        network: "eip155:84532",
        amount: "1000000",
        asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as `0x${string}`,
        payTo: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as `0x${string}`,
        maxTimeoutSeconds: 300,
      }],
    }, req, res);

    expect(res.statusCode).toBe(402);
  });

  test("returns 400 for invalid V1 payload", async () => {
    const req = createMockReq({ "x-payment": "not-valid-base64" });
    const res = createMockRes();

    await runMiddleware({
      requirements: {
        scheme: "exact",
        network: "base-sepolia",
        maxAmountRequired: "1000000",
        asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as `0x${string}`,
        payTo: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as `0x${string}`,
        resource: "http://localhost:3001/protected",
        description: "Test",
        maxTimeoutSeconds: 300,
      },
    }, req, res);

    expect(res.statusCode).toBeGreaterThanOrEqual(400);
  });

  test("middleware factory function exists", () => {
    expect(typeof paymentMiddleware).toBe("function");
  });

  test("middleware returns a function", () => {
    const middleware = paymentMiddleware({
      requirements: {
        scheme: "exact",
        network: "base-sepolia",
        maxAmountRequired: "1000000",
        asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as `0x${string}`,
        payTo: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as `0x${string}`,
        resource: "http://localhost:3001/protected",
        description: "Test",
        maxTimeoutSeconds: 300,
      },
    });
    expect(typeof middleware).toBe("function");
  });
});
