/**
 * V2 Spec Compliance Tests
 *
 * Validates that the PaymentPayload format matches the x402 v2 specification.
 */

import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { paymentMiddleware } from "@armory-sh/middleware-express";
import { encodePayment, isPaymentPayload, isPaymentPayloadV2 } from "@armory-sh/base";
import { createX402V2Payload } from "./fixtures/payloads";
import {
  mockFacilitator,
  createMockExpressRequest,
  createMockExpressResponse,
  TEST_REQUIREMENTS,
  MOCK_FACILITATOR_URL,
} from "./mocks";

describe("[e2e|v2-spec]: PaymentPayload Format Compliance", () => {
  let mockFetch: ReturnType<typeof mockFacilitator>;

  beforeEach(() => {
    mockFetch = mockFacilitator({ validateV2Format: true });
  });

  afterEach(() => {
    mockFetch.restore();
  });

  test("[createPaymentPayload|success] - includes accepted field", () => {
    const payload = createX402V2Payload();

    expect(payload.x402Version).toBe(2);
    expect(payload.accepted).toBeDefined();
    expect(payload.accepted.scheme).toBe("exact");
    expect(payload.accepted.network).toBe("eip155:84532");
    expect(payload.payload).toBeDefined();
  });

  test("[createPaymentPayload|success] - does not have scheme/network at top level", () => {
    const payload = createX402V2Payload();

    expect("scheme" in payload).toBe(false);
    expect("network" in payload).toBe(false);
    expect("accepted" in payload).toBe(true);
  });

  test("[isPaymentPayload|success] - validates accepted field", () => {
    const payload = createX402V2Payload();

    expect(isPaymentPayload(payload)).toBe(true);
    expect(isPaymentPayloadV2(payload)).toBe(true);
  });

  test("[fullFlow|success] - middleware accepts new payload format", async () => {
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

  test("[facilitator|request] - does not include x402Version at top level of body", async () => {
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

    const verifyBody = mockFetch.lastVerifyBody;
    expect(verifyBody).toBeDefined();
    expect(verifyBody?.paymentPayload).toBeDefined();
    expect(verifyBody?.paymentRequirements).toBeDefined();
    expect("x402Version" in (verifyBody as any)).toBe(false);
  });

  test("[accepted|match] - accepted field matches requirements", () => {
    const customRequirements = {
      scheme: "exact" as const,
      network: "eip155:1",
      maxAmountRequired: "5000000",
      asset: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
      payTo: "0xabcdef1234567890123456789012345678901234",
      maxTimeoutSeconds: 600,
    };

    const payload = createX402V2Payload("test_nonce", customRequirements);

    expect(payload.accepted.network).toBe("eip155:1");
    expect(payload.accepted.maxAmountRequired).toBe("5000000");
    expect(payload.accepted.maxTimeoutSeconds).toBe(600);
  });
});
