import { test, expect, describe } from "bun:test";
import { createBunMiddleware } from "../src/index";
import { createX402V2Payload, encodePayment } from "@armory-sh/base";

describe("[unit|middleware-bun]: Wrapped Flow", () => {
  test("[createBunMiddleware|success] - settles after successful handler response", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/verify")) {
        return new Response(JSON.stringify({ isValid: true, payer: "0x123" }), { status: 200 });
      }
      if (url.endsWith("/settle")) {
        return new Response(JSON.stringify({ success: true, transaction: "0xabc" }), { status: 200 });
      }
      return new Response(JSON.stringify({ error: "unexpected" }), { status: 500 });
    }) as typeof fetch;

    try {
      const middleware = createBunMiddleware(
        {
          payTo: "0x1234567890123456789012345678901234567890",
          network: "base",
          amount: "1",
          facilitator: { url: "http://facilitator.local" },
        },
        async () => new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "Content-Type": "application/json" } })
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
      const settlement = JSON.parse(Buffer.from(settlementHeader!, "base64").toString("utf-8"));
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
        return new Response(JSON.stringify({ isValid: true, payer: "0x123" }), { status: 200 });
      }
      if (url.endsWith("/settle")) {
        settleCalled = true;
        return new Response(JSON.stringify({ success: false, errorReason: "should-not-run" }), { status: 400 });
      }
      return new Response(JSON.stringify({ error: "unexpected" }), { status: 500 });
    }) as typeof fetch;

    try {
      const middleware = createBunMiddleware(
        {
          payTo: "0x1234567890123456789012345678901234567890",
          network: "base",
          amount: "1",
          facilitator: { url: "http://facilitator.local" },
        },
        async () => new Response(JSON.stringify({ ok: false }), { status: 500, headers: { "Content-Type": "application/json" } })
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
