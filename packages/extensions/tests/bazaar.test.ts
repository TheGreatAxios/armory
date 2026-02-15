import { describe, test, expect } from "bun:test";
import {
  declareDiscoveryExtension,
  extractDiscoveryInfo,
  validateDiscoveryExtension,
  isDiscoveryExtension,
  BAZAAR,
} from "../src/bazaar";
import type { PaymentPayloadV2, PaymentRequirementsV2 } from "@armory-sh/base";

describe("[unit|extensions]: Bazaar Discovery Extension", () => {
  describe("[unit|extensions]: declareDiscoveryExtension", () => {
    test("[declareDiscoveryExtension|success] - creates extension with no config", () => {
      const extension = declareDiscoveryExtension();

      expect(extension).toBeDefined();
      expect(extension.info).toBeDefined();
      expect(extension.schema).toBeDefined();
      expect(typeof extension.info).toBe("object");
      expect(typeof extension.schema).toBe("object");
    });

    test("[declareDiscoveryExtension|success] - creates extension with input schema", () => {
      const inputSchema = {
        type: "object" as const,
        properties: {
          location: {
            type: "string" as const,
          },
        },
      };

      const extension = declareDiscoveryExtension({
        inputSchema,
      });

      expect(extension.info.inputSchema).toBeDefined();
      expect(extension.info.inputSchema).toEqual(inputSchema);
    });

    test("[declareDiscoveryExtension|success] - creates extension with output", () => {
      const output = {
        example: { temperature: 72 },
        schema: {
          type: "object" as const,
          properties: {
            temperature: {
              type: "number" as const,
              unit: "F",
            },
          },
        },
      };

      const extension = declareDiscoveryExtension({
        output,
      });

      expect(extension.info.output).toBeDefined();
      expect(extension.info.output).toEqual(output);
    });

    test("[declareDiscoveryExtension|success] - creates extension with full config", () => {
      const config = {
        input: { location: "San Francisco" },
        inputSchema: {
          type: "object" as const,
          properties: {
            location: { type: "string" as const },
          },
        },
        bodyType: "json" as const,
        output: {
          example: { temperature: 72 },
        },
      };

      const extension = declareDiscoveryExtension(config);

      expect(extension.info.input).toEqual(config.input);
      expect(extension.info.inputSchema).toEqual(config.inputSchema);
      expect(extension.info.output).toEqual(config.output);
    });
  });

  describe("[unit|extensions]: validateDiscoveryExtension", () => {
    test("[validateDiscoveryExtension|success] - validates correct extension", () => {
      const extension = declareDiscoveryExtension();
      const result = validateDiscoveryExtension(extension);

      expect(result.valid).toBe(true);
      expect(result.errors).toBeUndefined();
    });

    test("[validateDiscoveryExtension|error] - rejects null", () => {
      const result = validateDiscoveryExtension(null);

      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors).toContain("Extension must be an object");
    });

    test("[validateDiscoveryExtension|error] - rejects object without info", () => {
      const result = validateDiscoveryExtension({ schema: {} });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Extension must have an 'info' field");
    });

    test("[validateDiscoveryExtension|error] - rejects object without schema", () => {
      const result = validateDiscoveryExtension({ info: {} });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Extension must have a 'schema' field");
    });
  });

  describe("[unit|extensions]: isDiscoveryExtension", () => {
    test("[isDiscoveryExtension|success] - identifies discovery extension", () => {
      const extension = declareDiscoveryExtension();

      expect(isDiscoveryExtension(extension)).toBe(true);
    });

    test("[isDiscoveryExtension|error] - rejects non-objects", () => {
      expect(isDiscoveryExtension(null)).toBe(false);
      expect(isDiscoveryExtension(undefined)).toBe(false);
      expect(isDiscoveryExtension("string")).toBe(false);
      expect(isDiscoveryExtension(123)).toBe(false);
    });

    test("[isDiscoveryExtension|error] - rejects objects without required fields", () => {
      expect(isDiscoveryExtension({})).toBe(false);
      expect(isDiscoveryExtension({ info: {} })).toBe(false);
      expect(isDiscoveryExtension({ schema: {} })).toBe(false);
    });
  });

  describe("[unit|extensions]: extractDiscoveryInfo", () => {
    test("[extractDiscoveryInfo|success] - extracts from valid payload", () => {
      const extension = declareDiscoveryExtension({
        input: { test: "value" },
      });

      const paymentPayload: PaymentPayloadV2 = {
        x402Version: 2,
        scheme: "exact",
        network: "eip155:8453",
        payload: {
          signature: "0x" + "a".repeat(130),
          authorization: {
            from: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1" as `0x${string}`,
            to: "0x1234567890123456789012345678901234567890" as `0x${string}`,
            value: "1000000",
            validAfter: "0",
            validBefore: "9999999999",
            nonce: "0x" + "0".repeat(64) as `0x${string}`,
          },
        },
        extensions: {
          bazaar: extension,
        },
      };

      const requirements: PaymentRequirementsV2 = {
        scheme: "exact",
        network: "eip155:8453",
        amount: "1000000",
        asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as `0x${string}`,
        payTo: "0x1234567890123456789012345678901234567890" as `0x${string}`,
        maxTimeoutSeconds: 300,
      };

      const result = extractDiscoveryInfo(paymentPayload, requirements);

      expect(result).not.toBeNull();
      expect(result?.input).toEqual({ test: "value" });
    });

    test("[extractDiscoveryInfo|success] - returns null when no bazaar extension", () => {
      const paymentPayload: PaymentPayloadV2 = {
        x402Version: 2,
        scheme: "exact",
        network: "eip155:8453",
        payload: {
          signature: "0x" + "a".repeat(130),
          authorization: {
            from: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1" as `0x${string}`,
            to: "0x1234567890123456789012345678901234567890" as `0x${string}`,
            value: "1000000",
            validAfter: "0",
            validBefore: "9999999999",
            nonce: "0x" + "0".repeat(64) as `0x${string}`,
          },
        },
      };

      const requirements: PaymentRequirementsV2 = {
        scheme: "exact",
        network: "eip155:8453",
        amount: "1000000",
        asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as `0x${string}`,
        payTo: "0x1234567890123456789012345678901234567890" as `0x${string}`,
        maxTimeoutSeconds: 300,
      };

      const result = extractDiscoveryInfo(paymentPayload, requirements);

      expect(result).toBeNull();
    });
  });

  describe("[unit|extensions]: BAZAAR constant", () => {
    test("[BAZAAR|success] - exports correct constant", () => {
      expect(BAZAAR).toBe("bazaar");
    });
  });
});
