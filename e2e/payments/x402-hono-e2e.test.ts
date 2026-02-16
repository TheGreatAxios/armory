/**
 * x402 Hono E2E Tests
 *
 * Tests x402 SDK compatibility with Hono middleware.
 * Uses mock facilitator - no HTTP server required.
 */

import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { advancedPaymentMiddleware } from "@armory-sh/middleware-hono";
import { encodePayment } from "@armory-sh/base";
import { createX402V2Payload } from "../general/fixtures/payloads";
import {
  mockFacilitator,
  createMockHonoContext,
  TEST_REQUIREMENTS,
  MOCK_FACILITATOR_URL,
} from "../general/mocks";

describe("[e2e|hono]: x402 SDK Compatibility", () => {
  let mockFetch: ReturnType<typeof mockFacilitator>;

  beforeEach(() => {
    mockFetch = mockFacilitator();
  });

  afterEach(() => {
    mockFetch.restore();
  });

  test("[middleware|success] - returns 402 when no payment header", async () => {
    const middleware = advancedPaymentMiddleware({
      requirements: TEST_REQUIREMENTS,
      facilitatorUrl: MOCK_FACILITATOR_URL,
    });

    const c = createMockHonoContext();
    let nextCalled = false;
    const next = async () => {
      nextCalled = true;
    };

    const result = await middleware(c as any, next);

    expect(result).toBeDefined();
    expect(result!.status).toBe(402);
    expect(nextCalled).toBe(false);
  });

  test("[middleware|success] - accepts valid x402 V2 payment", async () => {
    const middleware = advancedPaymentMiddleware({
      requirements: TEST_REQUIREMENTS,
      facilitatorUrl: MOCK_FACILITATOR_URL,
    });

    const payload = createX402V2Payload();
    const paymentHeader = encodePayment(payload);

    const c = createMockHonoContext({
      "payment-signature": paymentHeader,
    });
    let nextCalled = false;
    const next = async () => {
      nextCalled = true;
    };

    const result = await middleware(c as any, next);

    expect(nextCalled).toBe(true);
    expect(c.get("payment")).toBeDefined();
    expect(mockFetch.verifyCalls).toBe(1);
    expect(result).toBeUndefined();
  });

  test("[middleware|error] - returns 400 for invalid payment payload", async () => {
    const middleware = advancedPaymentMiddleware({
      requirements: TEST_REQUIREMENTS,
      facilitatorUrl: MOCK_FACILITATOR_URL,
    });

    const c = createMockHonoContext({
      "payment-signature": "not-valid-base64!!!",
    });
    let nextCalled = false;
    const next = async () => {
      nextCalled = true;
    };

    const result = await middleware(c as any, next);

    expect(result!.status).toBe(400);
    expect(nextCalled).toBe(false);
  });

  test("[middleware|error] - returns 402 when verification fails", async () => {
    mockFetch.restore();
    mockFetch = mockFacilitator({
      verifyResult: { isValid: false, invalidReason: "Invalid signature" },
    });

    const middleware = advancedPaymentMiddleware({
      requirements: TEST_REQUIREMENTS,
      facilitatorUrl: MOCK_FACILITATOR_URL,
    });

    const payload = createX402V2Payload();
    const paymentHeader = encodePayment(payload);

    const c = createMockHonoContext({
      "payment-signature": paymentHeader,
    });
    let nextCalled = false;
    const next = async () => {
      nextCalled = true;
    };

    const result = await middleware(c as any, next);

    expect(result!.status).toBe(402);
    expect(nextCalled).toBe(false);
  });
});
