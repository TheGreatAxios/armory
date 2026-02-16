/**
 * Complete Payment Flow E2E Tests
 *
 * Tests the full end-to-end payment flow using actual middleware
 * with mocked facilitator calls. No HTTP servers required.
 */

import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { paymentMiddleware } from "@armory-sh/middleware-express";
import { encodePayment } from "@armory-sh/base";
import { createX402V2Payload } from "./fixtures/payloads";
import {
  mockFacilitator,
  createMockExpressRequest,
  createMockExpressResponse,
  TEST_REQUIREMENTS,
  MOCK_FACILITATOR_URL,
} from "./mocks";

describe("[e2e|payment-flow]: Complete Payment Flow", () => {
  let mockFetch: ReturnType<typeof mockFacilitator>;

  beforeEach(() => {
    mockFetch = mockFacilitator();
  });

  afterEach(() => {
    mockFetch.restore();
  });

  describe("V2 Protocol Flow (PAYMENT-SIGNATURE header)", () => {
    test("[fullFlow|success] - completes full V2 payment flow", async () => {
      const middleware = paymentMiddleware({
        requirements: TEST_REQUIREMENTS,
        facilitatorUrl: MOCK_FACILITATOR_URL,
      });

      const payload = createX402V2Payload();
      const paymentHeader = encodePayment(payload);

      const req = createMockExpressRequest({
        "payment-signature": paymentHeader,
      });
      const res = createMockExpressResponse();
      let nextCalled = false;

      await middleware(req as any, res as any, () => {
        nextCalled = true;
      });

      expect(nextCalled).toBe(true);
      expect(req.payment).toBeDefined();
      expect(req.payment?.verified).toBe(true);
      expect(mockFetch.verifyCalls).toBe(1);
    });

    test("[fullFlow|error] - returns 402 without payment header", async () => {
      const middleware = paymentMiddleware({
        requirements: TEST_REQUIREMENTS,
        facilitatorUrl: MOCK_FACILITATOR_URL,
      });

      const req = createMockExpressRequest();
      const res = createMockExpressResponse();

      await middleware(req as any, res as any, () => {});

      expect(res.statusCode).toBe(402);
      expect(res.headers["PAYMENT-REQUIRED"]).toBeDefined();
    });

    test("[fullFlow|error] - returns 402 on verification failure", async () => {
      mockFetch.restore();
      mockFetch = mockFacilitator({
        verifyResult: { isValid: false, invalidReason: "Insufficient funds" },
      });

      const middleware = paymentMiddleware({
        requirements: TEST_REQUIREMENTS,
        facilitatorUrl: MOCK_FACILITATOR_URL,
      });

      const payload = createX402V2Payload();
      const paymentHeader = encodePayment(payload);

      const req = createMockExpressRequest({
        "payment-signature": paymentHeader,
      });
      const res = createMockExpressResponse();

      await middleware(req as any, res as any, () => {});

      expect(res.statusCode).toBe(402);
      expect(res.body).toHaveProperty("error", "Payment verification failed");
    });
  });

  describe("Payment Payload Handling", () => {
    test("[payload|error] - rejects malformed base64", async () => {
      const middleware = paymentMiddleware({
        requirements: TEST_REQUIREMENTS,
        facilitatorUrl: MOCK_FACILITATOR_URL,
      });

      const req = createMockExpressRequest({
        "payment-signature": "!!!invalid-base64!!!",
      });
      const res = createMockExpressResponse();

      await middleware(req as any, res as any, () => {});

      expect(res.statusCode).toBe(400);
      expect(res.body).toHaveProperty("error", "Invalid payment payload");
    });

    test("[payload|error] - rejects empty payload", async () => {
      const middleware = paymentMiddleware({
        requirements: TEST_REQUIREMENTS,
        facilitatorUrl: MOCK_FACILITATOR_URL,
      });

      const req = createMockExpressRequest({
        "payment-signature": "",
      });
      const res = createMockExpressResponse();

      await middleware(req as any, res as any, () => {});

      expect(res.statusCode).toBe(402);
    });
  });
});
