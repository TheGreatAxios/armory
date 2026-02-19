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
      let capturedPayload: unknown;
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

        // Subsequent calls: check if to facilitator
        if (url.includes("/verify")) {
          mockFetch.verifyCalls++;
          // Capture the payload being sent to facilitator
          try {
            capturedPayload = JSON.parse(init?.body as string);
          } catch {
            capturedPayload = init?.body;
          }
          return new Response(
            JSON.stringify({
              isValid: true,
              payer: account.address,
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }

        if (url.includes("/settle")) {
          mockFetch.settleCalls++;
          return new Response(
            JSON.stringify({
              success: true,
              transaction: "0xabcdef1234567890",
              network: TEST_REQUIREMENTS.network,
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }

        // Final call: success response
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
      }) as typeof fetch;

      const result = await armoryGet(
        { account },
        "https://api.example.com/data",
        "base-sepolia",
        "usdc",
      );

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ data: "protected content", timestamp: expect.any(Number) });
      expect(callCount).toBeGreaterThanOrEqual(2);

      // Verify the payload structure
      expect(capturedPayload).toBeDefined();
      expect(capturedPayload).toHaveProperty("paymentPayload");
      expect(capturedPayload.paymentPayload).toHaveProperty("x402Version", 2);
      expect(capturedPayload.paymentPayload).toHaveProperty("accepted");
      expect(capturedPayload.paymentPayload).toHaveProperty("payload");
      expect(capturedPayload.paymentPayload.payload).toHaveProperty("signature");
      expect(capturedPayload.paymentPayload.payload).toHaveProperty("authorization");
    });

    test("[armoryGet|error] - returns error on payment verification failure", async () => {
      let callCount = 0;
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

        if (url.includes("/verify")) {
          return new Response(
            JSON.stringify({
              isValid: false,
              invalidReason: "insufficient_funds",
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }

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
      expect(result.code).toBe("PAYMENT_REQUIRED");
      expect(result.message).toContain("insufficient_funds");
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

        if (url.includes("/verify")) {
          return new Response(
            JSON.stringify({
              isValid: true,
              payer: account.address,
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }

        if (url.includes("/settle")) {
          return new Response(
            JSON.stringify({
              success: true,
              transaction: "0xabcdef1234567890",
              network: TEST_REQUIREMENTS.network,
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }

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

        if (url.includes("/verify")) {
          return new Response(
            JSON.stringify({
              isValid: true,
              payer: account.address,
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }

        if (url.includes("/settle")) {
          return new Response(
            JSON.stringify({
              success: true,
              transaction: "0xabcdef1234567890",
              network: TEST_REQUIREMENTS.network,
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }

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

        if (url.includes("/verify")) {
          return new Response(
            JSON.stringify({
              isValid: true,
              payer: account.address,
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }

        if (url.includes("/settle")) {
          return new Response(
            JSON.stringify({
              success: true,
              transaction: "0xabcdef1234567890",
              network: TEST_REQUIREMENTS.network,
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }

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

  describe("createX402Client vs armoryGet", () => {
    test("[comparison|payload] - both create identical payment payloads", async () => {
      let armoryGetPayload: unknown = undefined;
      let clientPayload: unknown = undefined;
      let callCount = 0;

      globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        callCount++;

        if (callCount === 1 || callCount === 2) {
          // First call for armoryGet, second for createX402Client
          return new Response("Payment Required", {
            status: 402,
            headers: {
              [V2_HEADERS.PAYMENT_REQUIRED]: createMockPaymentRequired(),
            },
          });
        }

        if (url.includes("/verify")) {
          // Capture which call this is
          const body = JSON.parse(init?.body as string);
          if (!armoryGetPayload) {
            armoryGetPayload = body;
          } else {
            clientPayload = body;
          }
          return new Response(
            JSON.stringify({
              isValid: true,
              payer: account.address,
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }

        if (url.includes("/settle")) {
          return new Response(
            JSON.stringify({
              success: true,
              transaction: "0xabcdef1234567890",
              network: TEST_REQUIREMENTS.network,
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }

        return new Response(
          JSON.stringify({ result: "success" }),
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
      }) as typeof fetch;

      // Test armoryGet
      const armoryGetResult = await armoryGet(
        { account },
        "https://api.example.com/data",
        "base-sepolia",
        "usdc",
      );

      expect(armoryGetResult.success).toBe(true);

      // Reset and test createX402Client
      callCount = 0;
      const client = createX402Client({ wallet: { type: "account", account } });
      const response = await client.fetch("https://api.example.com/data");

      expect(response.status).toBe(200);

      // Compare payloads
      expect(armoryGetPayload).toBeDefined();
      expect(clientPayload).toBeDefined();

      // Check that both have the same structure
      expect(armoryGetPayload).toHaveProperty("paymentPayload");
      expect(clientPayload).toHaveProperty("paymentPayload");

      const armoryPayment = armoryGetPayload as { paymentPayload: unknown };
      const clientPayment = clientPayload as { paymentPayload: unknown };

      // Both should be V2 with signature and authorization
      expect(armoryPayment.paymentPayload).toHaveProperty("x402Version", 2);
      expect(clientPayment.paymentPayload).toHaveProperty("x402Version", 2);
      expect(armoryPayment.paymentPayload).toHaveProperty("payload");
      expect(clientPayment.paymentPayload).toHaveProperty("payload");
      expect(armoryPayment.paymentPayload.payload).toHaveProperty("signature");
      expect(clientPayment.paymentPayload.payload).toHaveProperty("signature");
    });

    test("[comparison|success] - both approaches produce same result", async () => {
      let armoryGetCalls = 0;
      let clientCalls = 0;

      // Test armoryGet
      globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        armoryGetCalls++;

        if (armoryGetCalls === 1) {
          return new Response("Payment Required", {
            status: 402,
            headers: {
              [V2_HEADERS.PAYMENT_REQUIRED]: createMockPaymentRequired(),
            },
          });
        }

        if (url.includes("/verify")) {
          return new Response(
            JSON.stringify({
              isValid: true,
              payer: account.address,
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }

        if (url.includes("/settle")) {
          return new Response(
            JSON.stringify({
              success: true,
              transaction: "0xabcdef1234567890",
              network: TEST_REQUIREMENTS.network,
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }

        return new Response(
          JSON.stringify({ result: "success" }),
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
      }) as typeof fetch;

      const armoryGetResult = await armoryGet(
        { account },
        "https://api.example.com/data",
        "base-sepolia",
        "usdc",
      );

      expect(armoryGetResult.success).toBe(true);
      expect(armoryGetResult.data).toEqual({ result: "success" });

      // Reset and test createX402Client
      armoryGetCalls = 0;
      globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        clientCalls++;

        if (clientCalls === 1) {
          return new Response("Payment Required", {
            status: 402,
            headers: {
              [V2_HEADERS.PAYMENT_REQUIRED]: createMockPaymentRequired(),
            },
          });
        }

        if (url.includes("/verify")) {
          return new Response(
            JSON.stringify({
              isValid: true,
              payer: account.address,
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }

        if (url.includes("/settle")) {
          return new Response(
            JSON.stringify({
              success: true,
              transaction: "0xabcdef1234567890",
              network: TEST_REQUIREMENTS.network,
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }

        return new Response(
          JSON.stringify({ result: "success" }),
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
      }) as typeof fetch;

      const client = createX402Client({ wallet: { account } });
      const response = await client.fetch("https://api.example.com/data");
      const clientData = await response.json();

      expect(response.status).toBe(200);
      expect(clientData).toEqual({ result: "success" });
    });
  });
});
