import { describe, expect, test } from "bun:test";
import type { PaymentPayloadV2, PaymentRequirementsV2 } from "@armory-sh/base";
import {
  declarePaymentIdentifierExtension,
  extractPaymentIdentifierInfo,
  isPaymentIdentifierExtension,
  isValidPaymentId,
  PAYMENT_IDENTIFIER,
  validatePaymentIdentifierExtension,
} from "../src/payment-identifier";

describe("[unit|extensions]: Payment Identifier Extension", () => {
  describe("[unit|extensions]: declarePaymentIdentifierExtension", () => {
    test("[declarePaymentIdentifierExtension|success] - creates extension with no config", () => {
      const extension = declarePaymentIdentifierExtension();

      expect(extension).toBeDefined();
      expect(extension.info).toBeDefined();
      expect(typeof extension.info).toBe("object");
    });

    test("[declarePaymentIdentifierExtension|success] - creates extension with paymentId", () => {
      const extension = declarePaymentIdentifierExtension({
        paymentId: "order-123456",
      });

      expect(extension.info.paymentId).toBe("order-123456");
      expect(extension.info.required).toBeUndefined();
    });

    test("[declarePaymentIdentifierExtension|success] - creates extension with required: true", () => {
      const extension = declarePaymentIdentifierExtension({
        required: true,
      });

      expect(extension.info.paymentId).toBeUndefined();
      expect(extension.info.required).toBe(true);
    });

    test("[declarePaymentIdentifierExtension|success] - creates extension with required: false", () => {
      const extension = declarePaymentIdentifierExtension({
        required: false,
      });

      expect(extension.info.paymentId).toBeUndefined();
      expect(extension.info.required).toBe(false);
    });

    test("[validatePaymentIdentifierExtension|success] - validates correct extension", () => {
      const extension = declarePaymentIdentifierExtension({
        paymentId: "valid-id-123",
      });

      const result = validatePaymentIdentifierExtension(extension);

      expect(result.valid).toBe(true);
      expect(result.errors).toBeUndefined();
    });

    test("[validatePaymentIdentifierExtension|error] - rejects missing info field", () => {
      const result = validatePaymentIdentifierExtension({});

      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Extension must have an 'info' field");
    });

    test("[validatePaymentIdentifierExtension|error] - rejects non-object extension", () => {
      const result = validatePaymentIdentifierExtension("string");

      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Extension must be an object");
    });

    test("[validatePaymentIdentifierExtension|error] - rejects non-string paymentId", () => {
      const extension = declarePaymentIdentifierExtension({
        paymentId: 123456 as any,
      });

      const result = validatePaymentIdentifierExtension(extension);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        "paymentId must be a string when defined",
      );
    });

    test("[validatePaymentIdentifierExtension|error] - rejects too long paymentId", () => {
      const extension = declarePaymentIdentifierExtension({
        paymentId: "a".repeat(129),
      });

      const result = validatePaymentIdentifierExtension(extension);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain("must be 128 characters or fewer");
    });

    test("[validatePaymentIdentifierExtension|error] - rejects invalid pattern paymentId", () => {
      const extension = declarePaymentIdentifierExtension({
        paymentId: "invalid id!",
      });

      const result = validatePaymentIdentifierExtension(extension);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        "alphanumeric, hyphens, and underscores only",
      );
    });

    test("[validatePaymentIdentifierExtension|error] - rejects non-boolean required", () => {
      const extension = declarePaymentIdentifierExtension({
        required: "not-a-boolean" as any,
      });

      const result = validatePaymentIdentifierExtension(extension);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain("required must be a boolean");
    });

    test("[isPaymentIdentifierExtension|success] - identifies payment identifier extension", () => {
      const extension = declarePaymentIdentifierExtension();

      expect(isPaymentIdentifierExtension(extension)).toBe(true);
    });

    test("[isPaymentIdentifierExtension|error] - rejects non-objects", () => {
      expect(isPaymentIdentifierExtension(null)).toBe(false);
      expect(isPaymentIdentifierExtension("string")).toBe(false);
      expect(isPaymentIdentifierExtension(123)).toBe(false);
    });

    test("[isValidPaymentId|success] - validates correct format", () => {
      expect(isValidPaymentId("order-123456")).toBe(true);
      expect(isValidPaymentId("ORD-123")).toBe(false);
      expect(isValidPaymentId("order_123-456")).toBe(true);
      expect(isValidPaymentId("a".repeat(200))).toBe(false);
    });

    test("[isValidPaymentId|error] - rejects too short", () => {
      expect(isValidPaymentId("")).toBe(false);
      expect(isValidPaymentId("ab")).toBe(false);
    });

    test("[isValidPaymentId|error] - rejects too long", () => {
      expect(isValidPaymentId("a".repeat(129))).toBe(false);
    });

    test("[extractPaymentIdentifierInfo|success] - extracts from valid payload", () => {
      const extension = declarePaymentIdentifierExtension({
        paymentId: "test-payment-id",
      });

      const paymentPayload: PaymentPayloadV2 = {
        x402Version: 2,
        scheme: "exact",
        network: "eip155:8453",
        payload: {
          signature: `0x${"a".repeat(130)}` as `0x${string}`,
          authorization: {
            from: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1" as `0x${string}`,
            to: "0x1234567890123456789012345678901234567890" as `0x${string}`,
            value: "1000000",
            validAfter: "0",
            validBefore: "9999999999",
            nonce: `0x${"0".repeat(64)}` as `0x${string}`,
          },
        },
        extensions: {
          "payment-identifier": extension,
        },
      };

      const requirements: PaymentRequirementsV2 = {
        scheme: "exact",
        network: "eip155:8453",
        amount: "1000000",
        asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as `0x${string}`,
        payTo: "0x12345678901234567890",
        maxTimeoutSeconds: 300,
      };

      const result = extractPaymentIdentifierInfo(paymentPayload);

      expect(result).toBe("test-payment-id");
    });

    test("[extractPaymentIdentifierInfo|success] - returns null when no payment identifier", () => {
      const paymentPayload: PaymentPayloadV2 = {
        x402Version: 2,
        scheme: "exact",
        network: "eip155:8453",
        payload: {
          signature: `0x${"a".repeat(130)}` as `0x${string}`,
          authorization: {
            from: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1" as `0x${string}`,
            to: "0x1234567890123456789012345678901234567890" as `0x${string}`,
            value: "1000000",
            validAfter: "0",
            validBefore: "9999999999",
            nonce: `0x${"0".repeat(64)}` as `0x${string}`,
          },
        },
        extensions: {},
      };

      const requirements: PaymentRequirementsV2 = {
        scheme: "exact",
        network: "eip155:8453",
        amount: "1000000",
        asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as `0x${string}`,
        payTo: "0x12345678901234567890",
        maxTimeoutSeconds: 300,
      };

      const result = extractPaymentIdentifierInfo(paymentPayload);

      expect(result).toBeNull();
    });

    test("[PAYMENT_IDENTIFIER|success] - exports correct constant", () => {
      expect(PAYMENT_IDENTIFIER).toBe("payment-identifier");
    });

    test("[PAYMENT_IDENTIFIER|success] - isPaymentIdentifierExtension type guard works", () => {
      const extension = declarePaymentIdentifierExtension();

      expect(isPaymentIdentifierExtension(extension)).toBe(true);
    });
  });
});
