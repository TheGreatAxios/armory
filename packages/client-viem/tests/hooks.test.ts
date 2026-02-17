/**
 * Hook System Tests for client-viem
 */

import { describe, expect, test } from "bun:test";
import type { PaymentPayloadV2, PaymentRequirementsV2 } from "@armory-sh/base";
import type {
  HookRegistry,
  PaymentPayloadContext,
  PaymentRequiredContext,
} from "../src/hooks";
import { executeHooks, mergeExtensions } from "../src/hooks-engine";

describe("[unit|client-viem]: Hook Engine", () => {
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

  describe("[executeHooks|priority] - executes hooks in priority order", () => {
    test("runs higher priority hooks first", async () => {
      const executionOrder: string[] = [];

      const hooks: HookRegistry = {
        lowPriority: {
          hook: async () => {
            executionOrder.push("low");
          },
          priority: 10,
          name: "low-priority",
        },
        highPriority: {
          hook: async () => {
            executionOrder.push("high");
          },
          priority: 100,
          name: "high-priority",
        },
        mediumPriority: {
          hook: async () => {
            executionOrder.push("medium");
          },
          priority: 50,
          name: "medium-priority",
        },
      };

      await executeHooks(hooks, mockPaymentContext);

      expect(executionOrder).toEqual(["high", "medium", "low"]);
    });

    test("uses default priority 0 when not specified", async () => {
      const executionOrder: string[] = [];

      const hooks: HookRegistry = {
        first: {
          hook: async () => {
            executionOrder.push("first");
          },
        },
        second: {
          hook: async () => {
            executionOrder.push("second");
          },
          priority: 0,
        },
      };

      await executeHooks(hooks, mockPaymentContext);

      expect(executionOrder).toContain("first");
      expect(executionOrder).toContain("second");
    });
  });

  describe("[executeHooks|error-handling] - handles hook errors gracefully", () => {
    test("continues execution after hook failure", async () => {
      const executed: string[] = [];

      const hooks: HookRegistry = {
        failing: {
          hook: async () => {
            executed.push("failing");
            throw new Error("Hook failed");
          },
          priority: 100,
        },
        succeeding: {
          hook: async () => {
            executed.push("succeeding");
          },
          priority: 50,
        },
      };

      await executeHooks(hooks, mockPaymentContext);

      expect(executed).toEqual(["failing", "succeeding"]);
    });
  });

  describe("[executeHooks|context-mutation] - allows hooks to modify context", () => {
    test("hooks can add extensions to payload", async () => {
      const paymentContext: PaymentPayloadContext = {
        payload: { ...mockPayload },
        requirements: mockRequirements,
        wallet: {
          type: "account",
          account: {
            address: "0xabcdef0123456789012345678901234567890123",
            type: "json-rpc",
          },
        },
        paymentContext: mockPaymentContext,
      };

      const hooks: HookRegistry = {
        customExtension: {
          hook: async (ctx) => {
            ctx.payload.extensions = {
              "custom-extension": { value: "test" },
            };
          },
          priority: 100,
        },
      };

      await executeHooks(hooks, paymentContext);

      expect(paymentContext.payload.extensions).toEqual({
        "custom-extension": { value: "test" },
      });
    });
  });

  describe("[mergeExtensions] - merges extension objects", () => {
    test("merges base and hook extensions", () => {
      const base = {
        "existing-extension": { data: "base" },
      };
      const hook = {
        "new-extension": { data: "hook" },
      };

      const result = mergeExtensions(base, hook);

      expect(result).toEqual({
        "existing-extension": { data: "base" },
        "new-extension": { data: "hook" },
      });
    });

    test("handles undefined base extensions", () => {
      const hook = {
        "new-extension": { data: "hook" },
      };

      const result = mergeExtensions(undefined, hook);

      expect(result).toEqual({
        "new-extension": { data: "hook" },
      });
    });

    test("hook extensions override base extensions", () => {
      const base = {
        extension: { version: 1 },
      };
      const hook = {
        extension: { version: 2 },
      };

      const result = mergeExtensions(base, hook);

      expect(result).toEqual({
        extension: { version: 2 },
      });
    });
  });
});
