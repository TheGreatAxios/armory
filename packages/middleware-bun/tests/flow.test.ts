import { describe, expect, test } from "bun:test";
import { encodePayment } from "@armory-sh/base";
import { createBunMiddleware } from "../src/index";

const TEST_PAYER_ADDRESS = "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1";
const TEST_PAY_TO_ADDRESS = "0x1234567890123456789012345678901234567890";
const TEST_CONTRACT_ADDRESS = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";

const DEFAULT_REQUIREMENTS = {
  scheme: "exact" as const,
  network: "eip155:84532",
  amount: "1000000",
  asset: TEST_CONTRACT_ADDRESS as `0x${string}`,
  payTo: TEST_PAY_TO_ADDRESS as `0x${string}`,
  maxTimeoutSeconds: 300,
};

const createX402V2Payload = () => ({
  x402Version: 2 as const,
  accepted: DEFAULT_REQUIREMENTS,
  payload: {
    signature: `0x${"b".repeat(130)}` as `0x${string}`,
    authorization: {
      from: TEST_PAYER_ADDRESS as `0x${string}`,
      to: TEST_PAY_TO_ADDRESS as `0x${string}`,
      value: "1000000",
      validAfter: Math.floor(Date.now() / 1000).toString(),
      validBefore: (Math.floor(Date.now() / 1000) + 3600).toString(),
      nonce:
        `0x${Buffer.from("test_nonce").toString("hex").padStart(64, "0")}` as `0x${string}`,
    },
  },
});

describe("[unit|middleware-bun]: Wrapped Flow", () => {
  test("[createBunMiddleware|success] - settles after successful handler response", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/verify")) {
        return new Response(JSON.stringify({ isValid: true, payer: "0x123" }), {
          status: 200,
        });
      }
      if (url.endsWith("/settle")) {
        return new Response(
          JSON.stringify({ success: true, transaction: "0xabc" }),
          { status: 200 },
        );
      }
      return new Response(JSON.stringify({ error: "unexpected" }), {
        status: 500,
      });
    }) as typeof fetch;

    try {
      const middleware = createBunMiddleware(
        {
          payTo: "0x1234567890123456789012345678901234567890",
          network: "base",
          amount: "1",
          facilitator: { url: "http://facilitator.local" },
        },
        async () =>
          new Response(JSON.stringify({ ok: true }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
      ) as (request: Request) => Promise<Response>;

      const payload = createX402V2Payload();
      const request = new Request("http://localhost/api/protected", {
        headers: {
          "PAYMENT-SIGNATURE": encodePayment(payload),
        },
      });

      const response = await middleware(request);

      expect(response.status).toBe(200);
      const settlementHeader = response.headers.get("PAYMENT-RESPONSE");
      expect(settlementHeader).toBeDefined();
      const settlement = JSON.parse(
        Buffer.from(settlementHeader!, "base64").toString("utf-8"),
      );
      expect(settlement.success).toBe(true);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test("[createBunMiddleware|success] - skips settlement when handler response is error", async () => {
    const originalFetch = globalThis.fetch;
    let settleCalled = false;
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/verify")) {
        return new Response(JSON.stringify({ isValid: true, payer: "0x123" }), {
          status: 200,
        });
      }
      if (url.endsWith("/settle")) {
        settleCalled = true;
        return new Response(
          JSON.stringify({ success: false, errorReason: "should-not-run" }),
          { status: 400 },
        );
      }
      return new Response(JSON.stringify({ error: "unexpected" }), {
        status: 500,
      });
    }) as typeof fetch;

    try {
      const middleware = createBunMiddleware(
        {
          payTo: "0x1234567890123456789012345678901234567890",
          network: "base",
          amount: "1",
          facilitator: { url: "http://facilitator.local" },
        },
        async () =>
          new Response(JSON.stringify({ ok: false }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          }),
      ) as (request: Request) => Promise<Response>;

      const payload = createX402V2Payload();
      const request = new Request("http://localhost/api/protected", {
        headers: {
          "PAYMENT-SIGNATURE": encodePayment(payload),
        },
      });

      const response = await middleware(request);

      expect(response.status).toBe(500);
      expect(response.headers.get("PAYMENT-RESPONSE")).toBeNull();
      expect(settleCalled).toBe(false);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
