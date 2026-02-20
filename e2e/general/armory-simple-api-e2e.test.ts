/**
 * Armory Simple API E2E Tests
 *
 * Tests armoryGet, armoryPost, etc. with real payment signing
 * and mocked facilitator responses.
 */

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
  encodePaymentV2,
  decodeSettlementV2,
  V2_HEADERS,
} from "@armory-sh/base";
import {
  armoryGet,
  armoryPost,
  armoryPay,
  createX402Client,
} from "@armory-sh/client-viem";
import { privateKeyToAccount } from "viem/accounts";
import { mockFacilitator, MOCK_FACILITATOR_URL, TEST_REQUIREMENTS } from "./mocks";

describe("[e2e|armory-simple-api]: armoryGet/armoryPost Payment Flow", () => {
  let mockFetch: ReturnType<typeof mockFacilitator>;
  const TEST_PRIVATE_KEY = `0x${"a".repeat(64)}`;
  const account = privateKeyToAccount(TEST_PRIVATE_KEY as `0x${string}`);

  beforeEach(() => {
    mockFetch = mockFacilitator();
  });

  afterEach(() => {
    mockFetch.restore();
  });

  function encodeResponse(data: object) {
    return Buffer.from(JSON.stringify(data))
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=/g, "");
  }

  function createMockPaymentRequired(
    overrides: Partial<{
      payTo: string;
      amount: string;
      network: string;
      asset: string;
    }> = {},
  ) {
    const paymentRequired = {
      x402Version: 2,
      resource: {
        url: "https://api.example.com/data",
        mimeType: "application/json",
      },
      accepts: [
        {
          scheme: "exact",
          payTo: overrides.payTo ?? TEST_REQUIREMENTS.payTo,
          amount: overrides.amount ?? TEST_REQUIREMENTS.amount,
          network: overrides.network ?? TEST_REQUIREMENTS.network,
          asset: overrides.asset ?? TEST_REQUIREMENTS.asset,
          maxTimeoutSeconds: 300,
        },
      ],
    };
    return Buffer.from(JSON.stringify(paymentRequired))
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=/g, "");
  }

  // ========================================
  // armoryGet Tests
  // ========================================

  describe("armoryGet", () => {
    test("[armoryGet|success] - completes full payment flow with GET request", async () => {
      let capturedPaymentHeader: string | undefined;
      let callCount = 0;
      globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        callCount++;

        if (callCount === 1) {
          // First call: 402 Payment Required
          return new Response("Payment Required", {
            status: 402,
            headers: {
              [V2_HEADERS.PAYMENT_REQUIRED]: createMockPaymentRequired(),
            },
          });
        }

        // Second call with payment signature - capture and return success
        const paymentHeader = new Headers(init?.headers).get(V2_HEADERS.PAYMENT_SIGNATURE);
        if (paymentHeader) {
          capturedPaymentHeader = paymentHeader;
          return new Response(
            JSON.stringify({ data: "protected content", timestamp: Date.now() }),
            {
              status: 200,
              headers: {
                [V2_HEADERS.PAYMENT_RESPONSE]: encodeResponse({
                  success: true,
                  transaction: "0xabcdef1234567890",
                  network: TEST_REQUIREMENTS.network,
                }),
              },
            },
          );
        }

        // Fallback
        return new Response("Unexpected call", { status: 500 });
      }) as typeof fetch;

      const result = await armoryGet(
        { account },
        "https://api.example.com/data",
        "base-sepolia",
        "usdc",
      );

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ data: "protected content", timestamp: expect.any(Number) });
      expect(callCount).toBe(2);

      // Verify the payment header was sent (base64 encoded)
      expect(capturedPaymentHeader).toBeDefined();
      const decoded = Buffer.from(capturedPaymentHeader!, "base64").toString();
      const payload = JSON.parse(decoded);
      expect(payload).toHaveProperty("x402Version", 2);
      expect(payload).toHaveProperty("payload");
      expect(payload.payload).toHaveProperty("signature");
    });

    test("[armoryGet|error] - returns error on payment verification failure", async () => {
      let callCount = 0;
      globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
        callCount++;

        if (callCount === 1) {
          return new Response("Payment Required", {
            status: 402,
            headers: {
              [V2_HEADERS.PAYMENT_REQUIRED]: createMockPaymentRequired(),
            },
          });
        }

        // Second call: server rejects payment with 402
        return new Response(
          JSON.stringify({
            error: "Payment verification failed",
            message: "insufficient_funds",
          }),
          { status: 402 },
        );
      }) as typeof fetch;

      const result = await armoryGet(
        { account },
        "https://api.example.com/data",
        "base-sepolia",
        "usdc",
      );

      expect(result.success).toBe(false);
      expect(result.code).toBe("NETWORK_ERROR");
      expect(result.message).toContain("Payment verification failed");
    });

    test("[armoryGet|error] - returns error on network failure", async () => {
      globalThis.fetch = async () =>
        Promise.reject(new Error("Network connection failed"));

      const result = await armoryGet(
        { account },
        "https://api.example.com/data",
        "base-sepolia",
        "usdc",
      );

      expect(result.success).toBe(false);
      expect(result.code).toBe("NETWORK_ERROR");
      expect(result.message).toContain("Network connection failed");
    });
  });

  // ========================================
  // armoryPost Tests
  // ========================================

  describe("armoryPost", () => {
    test("[armoryPost|success] - completes full payment flow with POST request", async () => {
      let callCount = 0;
      let capturedBody: unknown;
      let capturedPaymentHeader: string | undefined;

      globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        callCount++;

        if (callCount === 1) {
          return new Response("Payment Required", {
            status: 402,
            headers: {
              [V2_HEADERS.PAYMENT_REQUIRED]: createMockPaymentRequired(),
            },
          });
        }

        // Second call with payment signature
        const paymentHeader = new Headers(init?.headers).get(V2_HEADERS.PAYMENT_SIGNATURE);
        if (paymentHeader) {
          capturedPaymentHeader = paymentHeader;
          capturedBody = init?.body ? JSON.parse(String(init.body)) : undefined;
          return new Response(
            JSON.stringify({ created: true, id: 12345 }),
            {
              status: 201,
              headers: {
                [V2_HEADERS.PAYMENT_RESPONSE]: encodeResponse({
                  success: true,
                  transaction: "0xabcdef1234567890",
                  network: TEST_REQUIREMENTS.network,
                }),
              },
            },
          );
        }

        return new Response("Unexpected call", { status: 500 });
      }) as typeof fetch;

      const postData = { name: "Test Item", value: 42 };
      const result = await armoryPost(
        { account },
        "https://api.example.com/items",
        "base-sepolia",
        "usdc",
        postData,
      );

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ created: true, id: 12345 });
      expect(capturedBody).toEqual(postData);
      expect(capturedPaymentHeader).toBeDefined();
    });
  });

  // ========================================
  // armoryPay (generic) Tests
  // ========================================

  describe("armoryPay", () => {
    test("[armoryPay|success] - works with PUT request", async () => {
      let callCount = 0;
      let capturedMethod: string | undefined;

      globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        callCount++;

        if (callCount === 1) {
          return new Response("Payment Required", {
            status: 402,
            headers: {
              [V2_HEADERS.PAYMENT_REQUIRED]: createMockPaymentRequired(),
            },
          });
        }

        // Second call with payment signature
        const paymentHeader = new Headers(init?.headers).get(V2_HEADERS.PAYMENT_SIGNATURE);
        if (paymentHeader) {
          capturedMethod = init?.method;
          return new Response(
            JSON.stringify({ updated: true }),
            {
              status: 200,
              headers: {
                [V2_HEADERS.PAYMENT_RESPONSE]: encodeResponse({
                  success: true,
                  transaction: "0xabcdef1234567890",
                  network: TEST_REQUIREMENTS.network,
                }),
              },
            },
          );
        }

        return new Response("Unexpected call", { status: 500 });
      }) as typeof fetch;

      const result = await armoryPay(
        { account },
        "https://api.example.com/items/123",
        "base-sepolia",
        "usdc",
        {
          method: "PUT",
          body: { name: "Updated Item" },
        },
      );

      expect(result.success).toBe(true);
      expect(capturedMethod).toBe("PUT");
    });

    test("[armoryPay|success] - works with DELETE request", async () => {
      let callCount = 0;
      let capturedMethod: string | undefined;

      globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        callCount++;

        if (callCount === 1) {
          return new Response("Payment Required", {
            status: 402,
            headers: {
              [V2_HEADERS.PAYMENT_REQUIRED]: createMockPaymentRequired(),
            },
          });
        }

        // Second call with payment signature
        const paymentHeader = new Headers(init?.headers).get(V2_HEADERS.PAYMENT_SIGNATURE);
        if (paymentHeader) {
          capturedMethod = init?.method;
          return new Response(
            JSON.stringify({ deleted: true }),
            {
              status: 200,
              headers: {
                [V2_HEADERS.PAYMENT_RESPONSE]: encodeResponse({
                  success: true,
                  transaction: "0xabcdef1234567890",
                  network: TEST_REQUIREMENTS.network,
                }),
              },
            },
          );
        }

        return new Response("Unexpected call", { status: 500 });
      }) as typeof fetch;

      const result = await armoryPay(
        { account },
        "https://api.example.com/items/123",
        "base-sepolia",
        "usdc",
        {
          method: "DELETE",
        },
      );

      expect(result.success).toBe(true);
      expect(capturedMethod).toBe("DELETE");
    });
  });

  // ========================================
  // Comparison with createX402Client
  // ========================================

  describe("createX402Client", () => {
    test("[client|success] - completes full payment flow", async () => {
      let capturedPaymentHeader: string | undefined;
      let callCount = 0;

      globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
        callCount++;

        if (callCount === 1) {
          return new Response("Payment Required", {
            status: 402,
            headers: {
              [V2_HEADERS.PAYMENT_REQUIRED]: createMockPaymentRequired(),
            },
          });
        }

        // Second call with payment signature
        const paymentHeader = new Headers(init?.headers).get(V2_HEADERS.PAYMENT_SIGNATURE);
        if (paymentHeader) {
          capturedPaymentHeader = paymentHeader;
          return new Response(
            JSON.stringify({ result: "success" }),
            {
              status: 200,
              headers: {
                [V2_HEADERS.PAYMENT_RESPONSE]: encodeResponse({
                  success: true,
                  transaction: "0xabcdef1234567890",
                }),
              },
            },
          );
        }

        return new Response("Unexpected call", { status: 500 });
      }) as typeof fetch;

      const client = createX402Client({ wallet: { type: "account", account } });
      const response = await client.fetch("https://api.example.com/data");

      expect(response.status).toBe(200);
      expect(capturedPaymentHeader).toBeDefined();
      const decoded = Buffer.from(capturedPaymentHeader!, "base64").toString();
      const payload = JSON.parse(decoded);
      expect(payload).toHaveProperty("x402Version", 2);
    });
  });
});
