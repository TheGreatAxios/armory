/**
 * Extension Hook Creators Tests
 */

import { describe, expect, test } from "bun:test";
import type {
  PaymentPayloadContext,
  PaymentPayloadV2,
  PaymentRequiredContext,
  PaymentRequirementsV2,
} from "@armory-sh/base";
import {
  createCustomHook,
  createPaymentIdHook,
  createSIWxHook,
} from "../src/hooks";

describe("[unit|extensions]: Hook Creators", () => {
  const mockRequirements: PaymentRequirementsV2 = {
    scheme: "exact",
    network: "eip155:8453",
    amount: "1000000",
    asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    payTo: "0x1234567890123456789012345678901234567890",
    maxTimeoutSeconds: 3600,
  };

  const mockPaymentContext: PaymentRequiredContext = {
    url: "https://api.example.com/protected",
    requestInit: undefined,
    requirements: mockRequirements,
    serverExtensions: undefined,
    fromAddress: "0xabcdef0123456789012345678901234567890123",
    nonce: "0x1234567890abcdef",
    validBefore: Math.floor(Date.now() / 1000) + 3600,
  };

  const mockPayload: PaymentPayloadV2 = {
    x402Version: 2,
    scheme: "exact",
    network: "eip155:8453",
    payload: {
      signature: "0x",
      authorization: {
        from: "0xabcdef0123456789012345678901234567890123",
        to: "0x1234567890123456789012345678901234567890123",
        value: "1000000",
        validAfter: "0",
        validBefore: "1234567890",
        nonce: "0x1234567890abcdef",
      },
    },
  };

  describe("[createSIWxHook|config] - creates SIWx hook with config", () => {
    test("returns hook config with correct name and priority", () => {
      const hook = createSIWxHook({ domain: "example.com" });

      expect(hook.name).toBe("sign-in-with-x");
      expect(hook.priority).toBe(100);
      expect(typeof hook.hook).toBe("function");
    });

    test("returns hook config without config", () => {
      const hook = createSIWxHook();

      expect(hook.name).toBe("sign-in-with-x");
      expect(hook.priority).toBe(100);
      expect(typeof hook.hook).toBe("function");
    });
  });

  describe("[createPaymentIdHook|config] - creates payment ID hook with config", () => {
    test("returns hook config with correct name and priority", () => {
      const hook = createPaymentIdHook({ paymentId: "test-id-123" });

      expect(hook.name).toBe("payment-identifier");
      expect(hook.priority).toBe(50);
      expect(typeof hook.hook).toBe("function");
    });

    test("returns hook config without config", () => {
      const hook = createPaymentIdHook();

      expect(hook.name).toBe("payment-identifier");
      expect(hook.priority).toBe(50);
      expect(typeof hook.hook).toBe("function");
    });
  });

  describe("[createCustomHook|config] - creates custom hook with config", () => {
    test("returns hook config with provided values", () => {
      const handler = async () => {};
      const hook = createCustomHook({
        key: "my-custom-hook",
        handler,
        priority: 75,
      });

      expect(hook.name).toBe("my-custom-hook");
      expect(hook.priority).toBe(75);
      expect(hook.hook).toBe(handler);
    });

    test("uses default priority 0 when not specified", () => {
      const handler = async () => {};
      const hook = createCustomHook({
        key: "my-hook",
        handler,
      });

      expect(hook.priority).toBe(0);
    });
  });

  describe("[createCustomHook|execution] - custom hook modifies context", () => {
    test("custom hook can modify payload extensions", async () => {
      const paymentContext: PaymentPayloadContext = {
        payload: { ...mockPayload },
        requirements: mockRequirements,
        wallet: {} as any,
        paymentContext: mockPaymentContext,
      };

      const hook = createCustomHook({
        key: "test-hook",
        handler: async (ctx) => {
          ctx.payload.extensions = {
            "test-extension": { value: "modified" },
          };
        },
      });

      await hook.hook(paymentContext);

      expect(paymentContext.payload.extensions).toEqual({
        "test-extension": { value: "modified" },
      });
    });
  });
});
