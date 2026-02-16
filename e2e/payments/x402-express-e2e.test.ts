/**
 * x402 Express E2E Tests
 *
 * Tests x402 SDK compatibility with Express middleware.
 * Uses mock facilitator - no HTTP server required.
 */

import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { paymentMiddleware } from "@armory-sh/middleware-express";
import { encodePayment } from "@armory-sh/base";
import { createX402V2Payload } from "../general/fixtures/payloads";
import {
  mockFacilitator,
  createMockExpressRequest,
  createMockExpressResponse,
  TEST_REQUIREMENTS,
  MOCK_FACILITATOR_URL,
} from "../general/mocks";

describe("[e2e|express]: x402 SDK Compatibility", () => {
  let mockFetch: ReturnType<typeof mockFacilitator>;

  beforeEach(() => {
    mockFetch = mockFacilitator();
  });

  afterEach(() => {
    mockFetch.restore();
  });

  test("[middleware|success] - returns 402 when no payment header", async () => {
    const middleware = paymentMiddleware({
      requirements: TEST_REQUIREMENTS,
      facilitatorUrl: MOCK_FACILITATOR_URL,
    });

    const req = createMockExpressRequest();
    const res = createMockExpressResponse();
    let nextCalled = false;
    const next = () => {
      nextCalled = true;
    };

    await middleware(req as any, res as any, next);

    expect(res.statusCode).toBe(402);
    expect(nextCalled).toBe(false);
    expect(res.headers["PAYMENT-REQUIRED"]).toBeDefined();
  });

  test("[middleware|success] - accepts valid x402 V2 payment", async () => {
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
    const next = () => {
      nextCalled = true;
    };

    await middleware(req as any, res as any, next);

    expect(nextCalled).toBe(true);
    expect(req.payment).toBeDefined();
    expect(req.payment?.verified).toBe(true);
    expect(mockFetch.verifyCalls).toBe(1);
  });

  test("[middleware|error] - returns 400 for invalid payment payload", async () => {
    const middleware = paymentMiddleware({
      requirements: TEST_REQUIREMENTS,
      facilitatorUrl: MOCK_FACILITATOR_URL,
    });

    const req = createMockExpressRequest({
      "payment-signature": "not-valid-base64!!!",
    });
    const res = createMockExpressResponse();
    let nextCalled = false;
    const next = () => {
      nextCalled = true;
    };

    await middleware(req as any, res as any, next);

    expect(res.statusCode).toBe(400);
    expect(nextCalled).toBe(false);
  });

  test("[middleware|error] - returns 402 when verification fails", async () => {
    mockFetch.restore();
    mockFetch = mockFacilitator({
      verifyResult: { isValid: false, invalidReason: "Invalid signature" },
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
    let nextCalled = false;
    const next = () => {
      nextCalled = true;
    };

    await middleware(req as any, res as any, next);

    expect(res.statusCode).toBe(402);
    expect(nextCalled).toBe(false);
    expect(res.body).toHaveProperty("error", "Payment verification failed");
  });
});
