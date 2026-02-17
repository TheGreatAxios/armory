/**
 * Hono Middleware Integration Tests
 * Tests full middleware flow including:
 * - 402 response when no payment header provided
 * - Error handling for invalid payloads
 */
import { describe, expect, mock, test } from "bun:test";
import type { PaymentRequirementsV2, X402PaymentPayload } from "@armory-sh/base";
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

  test("[unit|middleware-hono] - [paymentMiddleware|success] - verifies and settles using accepted non-primary requirement", async () => {
    const app = new Hono();
    const payTo = "0x1234567890123456789012345678901234567890";
    const payer = "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1";
    const skaleRequirement = {
      scheme: "exact" as const,
      network: "eip155:324705682",
      amount: "1000000",
      asset: "0x2e08028E3C4c2356572E096d8EF835cD5C6030bD" as `0x${string}`,
      payTo: payTo as `0x${string}`,
      maxTimeoutSeconds: 300,
      extra: {
        name: "Bridged USDC (SKALE Bridge)",
        version: "2",
      },
    };

    app.use(
      "/*",
      paymentMiddleware({
        payTo,
        chains: ["base-sepolia", "skale-base-sepolia"],
        token: "usdc",
        amount: "1.0",
        facilitatorUrl: "https://facilitator.test",
      }),
    );
    app.get("/api/test", (c) => c.json({ success: true }));

    const verificationNetworks: string[] = [];
    const originalFetch = global.fetch;
    global.fetch = mock(async (input, init) => {
      const url = String(input);
      if (url.endsWith("/verify") || url.endsWith("/settle")) {
        const body = JSON.parse(String(init?.body)) as {
          paymentRequirements: { network: string };
        };
        verificationNetworks.push(body.paymentRequirements.network);
      }
      if (url.endsWith("/verify")) {
        return new Response(
          JSON.stringify({ isValid: true, payer }),
          { status: 200 },
        );
      }
      if (url.endsWith("/settle")) {
        return new Response(
          JSON.stringify({
            success: true,
            transaction: "0xabc123",
            network: skaleRequirement.network,
          }),
          { status: 200 },
        );
      }
      return new Response("Not Found", { status: 404 });
    }) as typeof fetch;

    const payload: X402PaymentPayload = {
      x402Version: 2,
      accepted: skaleRequirement,
      payload: {
        signature: `0x${"b".repeat(130)}` as `0x${string}`,
        authorization: {
          from: payer as `0x${string}`,
          to: payTo as `0x${string}`,
          value: "1000000",
          validAfter: "0",
          validBefore: "9999999999",
          nonce: `0x${"1".repeat(64)}` as `0x${string}`,
        },
      },
    };

    try {
      const req = new Request(new URL("http://localhost/api/test"), {
        headers: {
          "PAYMENT-SIGNATURE": JSON.stringify(payload),
        },
      });
      const res = await app.fetch(req);

      expect(res.status).toBe(200);
      expect(res.headers.get("PAYMENT-RESPONSE")).toBeDefined();
      expect(verificationNetworks).toEqual([
        "eip155:324705682",
        "eip155:324705682",
      ]);
    } finally {
      global.fetch = originalFetch;
    }
  });
});
