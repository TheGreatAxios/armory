import { describe, expect, test } from "bun:test";
import type {
  Extensions,
  PaymentPayloadV2,
  PaymentRequiredV2,
} from "@armory-sh/base";
import {
  BAZAAR,
  declareDiscoveryExtension,
  declareSIWxExtension,
  SIGN_IN_WITH_X,
} from "../src/index";

describe("[e2e|extensions]: Cross-SDK Compatibility Tests", () => {
  describe("[e2e|extensions]: Bazaar Extension", () => {
    test("[declareDiscoveryExtension|compatibility] - creates wire-compatible extension", () => {
      const bazaarConfig = {
        input: { location: "San Francisco" },
        inputSchema: {
          type: "object" as const,
          properties: {
            location: { type: "string" as const },
          },
        },
        output: {
          example: { temperature: 72, unit: "F" },
          schema: {
            type: "object" as const,
            properties: {
              temperature: { type: "number" as const },
              unit: { type: "string" as const },
            },
          },
        },
      };

      const extension = declareDiscoveryExtension(bazaarConfig);

      expect(extension.info).toBeDefined();
      expect(extension.info.input).toEqual(bazaarConfig.input);
      expect(extension.info.inputSchema).toEqual(bazaarConfig.inputSchema);
    });

    test("[BazaarExtension|wire-format] - serializes to valid JSON", () => {
      const extension = declareDiscoveryExtension({
        input: { test: "value" },
      });

      const serialized = JSON.stringify(extension);
      const parsed = JSON.parse(serialized);

      expect(parsed).toHaveProperty("info");
    });
  });

  describe("[e2e|extensions]: SIWX Extension", () => {
    test("[declareSIWxExtension|compatibility] - creates wire-compatible extension", () => {
      const siwxConfig = {
        domain: "example.com",
        resourceUri: "https://api.example.com/resource",
        network: "eip155:8453",
        statement: "Please sign in to access the API",
        version: "1",
        expirationSeconds: 3600,
      };

      const extension = declareSIWxExtension(siwxConfig);

      expect(extension.info).toBeDefined();
      expect(extension.info.domain).toBe(siwxConfig.domain);
      expect(extension.info.resourceUri).toBe(siwxConfig.resourceUri);
      expect(extension.info.network).toBe(siwxConfig.network);
    });

    test("[SIWxExtension|wire-format] - serializes to valid JSON", () => {
      const extension = declareSIWxExtension({
        domain: "example.com",
      });

      const serialized = JSON.stringify(extension);
      const parsed = JSON.parse(serialized);

      expect(parsed).toHaveProperty("info");
    });
  });

  describe("[e2e|extensions]: Payment Required with Extensions", () => {
    test("[PaymentRequiredV2|compatibility] - includes extensions in response", () => {
      const bazaarExtension = declareDiscoveryExtension({
        input: { test: "value" },
      });

      const siwxExtension = declareSIWxExtension({
        domain: "example.com",
      });

      const paymentRequired: PaymentRequiredV2 = {
        x402Version: 2,
        error: "Payment required",
        resource: {
          url: "https://api.example.com/weather",
          description: "Weather API",
          mimeType: "application/json",
        },
        accepts: [
          {
            scheme: "exact",
            network: "eip155:8453",
            amount: "1000000",
            asset:
              "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as `0x${string}`,
            payTo:
              "0x1234567890123456789012345678901234567890" as `0x${string}`,
            maxTimeoutSeconds: 300,
          },
        ],
        extensions: {
          bazaar: bazaarExtension,
          "sign-in-with-x": siwxExtension,
        },
      };

      expect(paymentRequired.extensions).toBeDefined();
      expect(paymentRequired.extensions?.bazaar).toBeDefined();
      expect(paymentRequired.extensions?.["sign-in-with-x"]).toBeDefined();
    });

    test("[PaymentRequiredV2|serialization] - Base64 encodes with extensions", () => {
      const bazaarExtension = declareDiscoveryExtension();
      const paymentRequired: PaymentRequiredV2 = {
        x402Version: 2,
        error: "Payment required",
        resource: {
          url: "https://api.example.com/resource",
          description: "API Resource",
        },
        accepts: [
          {
            scheme: "exact",
            network: "eip155:8453",
            amount: "1000000",
            asset:
              "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as `0x${string}`,
            payTo:
              "0x1234567890123456789012345678901234567890" as `0x${string}`,
            maxTimeoutSeconds: 300,
          },
        ],
        extensions: {
          bazaar: bazaarExtension,
        },
      };

      const serialized = JSON.stringify(paymentRequired);
      const encoded = btoa(serialized);
      const decoded = atob(encoded);
      const parsed = JSON.parse(decoded) as PaymentRequiredV2;

      expect(parsed.x402Version).toBe(2);
      expect(parsed.extensions).toBeDefined();
      expect(parsed.extensions?.bazaar).toBeDefined();
    });
  });

  describe("[e2e|extensions]: Payment Payload with Extensions", () => {
    test("[PaymentPayloadV2|compatibility] - includes extensions in payload", () => {
      const siwxExtension = declareSIWxExtension({
        domain: "example.com",
      });

      const paymentPayload: PaymentPayloadV2 = {
        x402Version: 2,
        scheme: "exact",
        network: "eip155:8453",
        payload: {
          signature: `0x${"a".repeat(130)}`,
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
          "sign-in-with-x": siwxExtension,
        },
      };

      expect(paymentPayload.extensions).toBeDefined();
      expect(paymentPayload.extensions?.["sign-in-with-x"]).toBeDefined();
    });
  });

  describe("[e2e|extensions]: Extension Constants", () => {
    test("[BAZAAR|compatibility] - matches Coinbase spec", () => {
      expect(BAZAAR).toBe("bazaar");
    });

    test("[SIGN_IN_WITH_X|compatibility] - matches Coinbase spec", () => {
      expect(SIGN_IN_WITH_X).toBe("sign-in-with-x");
    });
  });

  describe("[e2e|extensions]: Extension Structure", () => {
    test("[Extension|compatibility] - has info field", () => {
      const extension = declareDiscoveryExtension();

      expect(extension).toHaveProperty("info");
      expect(typeof extension.info).toBe("object");
    });

    test("[Extensions|compatibility] - allows any string keys", () => {
      const extensions: Extensions = {
        custom: { data: "value" },
        "another-custom": { more: "data" },
        bazaar: declareDiscoveryExtension(),
        "sign-in-with-x": declareSIWxExtension(),
      };

      expect(Object.keys(extensions)).toHaveLength(4);
      expect(extensions.custom).toBeDefined();
      expect(extensions["another-custom"]).toBeDefined();
    });
  });
});
