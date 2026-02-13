/**
 * x402 V2 Protocol Compatibility Tests
 *
 * Tests V2 format:
 * - PAYMENT-REQUIRED header parsing (JSON, x402Version: 2)
 * - PAYMENT-SIGNATURE header generation
 * - PAYMENT-RESPONSE header parsing
 */

import { describe, test, expect } from "bun:test";
import {
  // V2 specific
  V2_HEADERS,
  isPaymentRequiredV2,
  isPaymentPayloadV2,
  isCAIP2ChainId,
  isCAIPAssetId,
  assetIdToAddress,
  addressToAssetId,
  parseSignatureV2,
  combineSignatureV2,
  type PaymentRequiredV2,
  type PaymentPayloadV2,
  type PaymentRequirementsV2,
  type SettlementResponseV2,
  type SchemePayloadV2,
  type EIP3009Authorization,
  type CAIP2Network,
  type CAIPAssetId,
  type ResourceInfo,
  // Shared utilities
  safeBase64Encode,
  safeBase64Decode,
} from "@armory-sh/base";

// ============================================
// Test Fixtures
// ============================================

const mockResourceInfo: ResourceInfo = {
  url: "https://api.example.com/premium/data",
  description: "Premium API data endpoint",
  mimeType: "application/json",
};

const mockRequirementsV2: PaymentRequirementsV2 = {
  scheme: "exact",
  network: "eip155:84532", // Base Sepolia
  amount: "1500000", // 1.5 USDC (6 decimals)
  asset: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
  payTo: "0x1234567890123456789012345678901234567890",
  maxTimeoutSeconds: 3600,
  extra: {
    name: "USD Coin",
    version: "2",
  },
};

const mockAuthorizationV2: EIP3009Authorization = {
  from: "0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B",
  to: "0x1234567890123456789012345678901234567890",
  value: "1500000",
  validAfter: "1700000000",
  validBefore: "1700003600",
  nonce: "0x0000000000000000000000000000000000000000000000000000000000000001",
};

const mockSchemePayloadV2: SchemePayloadV2 = {
  signature:
    "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1c",
  authorization: mockAuthorizationV2,
};

const mockPaymentPayloadV2: PaymentPayloadV2 = {
  x402Version: 2,
  resource: mockResourceInfo,
  accepted: mockRequirementsV2,
  payload: mockSchemePayloadV2,
  extensions: {},
};

const mockPaymentRequiredV2: PaymentRequiredV2 = {
  x402Version: 2,
  error: "Payment required",
  resource: mockResourceInfo,
  accepts: [mockRequirementsV2],
  extensions: {},
};

const mockSettlementResponseV2: SettlementResponseV2 = {
  success: true,
  transaction: "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
  network: "eip155:84532",
  payer: "0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B",
  extensions: {},
};

// Helper functions for V2 encoding (since V2 uses plain JSON)
function encodePaymentRequiredV2(data: PaymentRequiredV2): string {
  return Buffer.from(JSON.stringify(data)).toString("base64");
}

function decodePaymentRequiredV2(encoded: string): PaymentRequiredV2 {
  return JSON.parse(Buffer.from(encoded, "base64").toString("utf-8")) as PaymentRequiredV2;
}

function encodePaymentPayloadV2(data: PaymentPayloadV2): string {
  return Buffer.from(JSON.stringify(data)).toString("base64");
}

function decodePaymentPayloadV2(encoded: string): PaymentPayloadV2 {
  return JSON.parse(Buffer.from(encoded, "base64").toString("utf-8")) as PaymentPayloadV2;
}

function encodeSettlementResponseV2(data: SettlementResponseV2): string {
  return Buffer.from(JSON.stringify(data)).toString("base64");
}

function decodeSettlementResponseV2(encoded: string): SettlementResponseV2 {
  return JSON.parse(Buffer.from(encoded, "base64").toString("utf-8")) as SettlementResponseV2;
}

// ============================================
// V2 Header Constants Tests
// ============================================

describe("x402 V2 Headers", () => {
  test("V2 headers have correct names", () => {
    expect(V2_HEADERS.PAYMENT_SIGNATURE).toBe("PAYMENT-SIGNATURE");
    expect(V2_HEADERS.PAYMENT_REQUIRED).toBe("PAYMENT-REQUIRED");
    expect(V2_HEADERS.PAYMENT_RESPONSE).toBe("PAYMENT-RESPONSE");
  });

  test("V2 headers are distinct from V1 headers", () => {
    // V2 uses PAYMENT-SIGNATURE, V1 uses X-PAYMENT
    expect(V2_HEADERS.PAYMENT_SIGNATURE).toBe("PAYMENT-SIGNATURE");
    expect(V2_HEADERS.PAYMENT_REQUIRED).toBe("PAYMENT-REQUIRED"); // No X- prefix
    expect(V2_HEADERS.PAYMENT_RESPONSE).toBe("PAYMENT-RESPONSE"); // No X- prefix
  });
});

// ============================================
// CAIP Format Tests
// ============================================

describe("CAIP-2 Format Validation", () => {
  describe("isCAIP2ChainId", () => {
    test("validates correct CAIP-2 format", () => {
      expect(isCAIP2ChainId("eip155:1")).toBe(true);
      expect(isCAIP2ChainId("eip155:8453")).toBe(true);
      expect(isCAIP2ChainId("eip155:84532")).toBe(true);
      expect(isCAIP2ChainId("eip155:137")).toBe(true);
      expect(isCAIP2ChainId("eip155:42161")).toBe(true);
    });

    test("rejects invalid CAIP-2 format", () => {
      expect(isCAIP2ChainId("base")).toBe(false);
      expect(isCAIP2ChainId("ethereum")).toBe(false);
      expect(isCAIP2ChainId("1")).toBe(false);
      expect(isCAIP2ChainId("eip155:")).toBe(false);
      expect(isCAIP2ChainId(":8453")).toBe(false);
      expect(isCAIP2ChainId("EIP155:8453")).toBe(false); // Case sensitive
    });
  });

  describe("isCAIPAssetId", () => {
    test("validates correct CAIP Asset ID format", () => {
      expect(isCAIPAssetId("eip155:1/erc20:0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48")).toBe(true);
      expect(isCAIPAssetId("eip155:8453/erc20:0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913")).toBe(true);
    });

    test("rejects invalid CAIP Asset ID format", () => {
      expect(isCAIPAssetId("0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48")).toBe(false);
      expect(isCAIPAssetId("eip155:1")).toBe(false);
      expect(isCAIPAssetId("eip155:1/erc20:")).toBe(false);
    });
  });

  describe("assetIdToAddress", () => {
    test("extracts address from CAIP Asset ID", () => {
      const address = assetIdToAddress("eip155:1/erc20:0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48");
      expect(address).toBe("0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48");
    });

    test("extracts address from Base USDC Asset ID", () => {
      const address = assetIdToAddress("eip155:8453/erc20:0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913");
      expect(address).toBe("0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913");
    });

    test("throws for invalid CAIP Asset ID", () => {
      expect(() => assetIdToAddress("invalid")).toThrow();
    });
  });

  describe("addressToAssetId", () => {
    test("creates CAIP Asset ID from address and chain ID number", () => {
      const assetId = addressToAssetId("0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", 8453);
      expect(assetId).toBe("eip155:8453/erc20:0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913");
    });

    test("creates CAIP Asset ID from address and CAIP-2 chain ID", () => {
      const assetId = addressToAssetId("0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", "eip155:84532");
      expect(assetId).toBe("eip155:84532/erc20:0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913");
    });
  });
});

// ============================================
// Signature Parsing Tests
// ============================================

describe("Signature Utilities", () => {
  describe("parseSignatureV2", () => {
    test("parses 65-byte signature into components", () => {
      const signature =
        "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1c";

      const parsed = parseSignatureV2(signature);

      expect(parsed.r).toBe("0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef");
      expect(parsed.s).toBe("0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef");
      expect(parsed.v).toBe(28);
    });

    test("parses v=27 signature", () => {
      const signature =
        "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1b";

      const parsed = parseSignatureV2(signature);

      expect(parsed.v).toBe(27);
    });

    test("parses v=28 signature", () => {
      const signature =
        "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1c";

      const parsed = parseSignatureV2(signature);

      expect(parsed.v).toBe(28);
    });
  });

  describe("combineSignatureV2", () => {
    test("combines signature components into 65-byte hex", () => {
      const combined = combineSignatureV2(
        28,
        "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
        "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890"
      );

      expect(combined).toBe(
        "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdefabcdef1234567890abcdef1234567890abcdef1234567890abcdef12345678901c"
      );
    });

    test("handles non-prefixed r and s values", () => {
      const combined = combineSignatureV2(
        27,
        "1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
        "abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890"
      );

      expect(combined.startsWith("0x")).toBe(true);
      expect(combined.length).toBe(132); // 0x + 130 hex chars
    });
  });

  describe("Round-trip signature", () => {
    test("parse and combine preserves signature", () => {
      const original =
        "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef12345678901234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1b";

      const parsed = parseSignatureV2(original);
      const combined = combineSignatureV2(parsed.v, parsed.r, parsed.s);

      expect(combined).toBe(original);
    });
  });
});

// ============================================
// V2 Payment Required Header Tests
// ============================================

describe("x402 V2 PAYMENT-REQUIRED Header", () => {
  describe("Encoding", () => {
    test("encodes payment required to Base64", () => {
      const encoded = encodePaymentRequiredV2(mockPaymentRequiredV2);

      expect(typeof encoded).toBe("string");
      expect(encoded.length).toBeGreaterThan(0);
    });

    test("includes x402Version: 2 in encoded payload", () => {
      const encoded = encodePaymentRequiredV2(mockPaymentRequiredV2);
      const decoded = decodePaymentRequiredV2(encoded);

      expect(decoded.x402Version).toBe(2);
    });

    test("includes resource information", () => {
      const encoded = encodePaymentRequiredV2(mockPaymentRequiredV2);
      const decoded = decodePaymentRequiredV2(encoded);

      expect(decoded.resource).toBeDefined();
      expect(decoded.resource.url).toBe(mockResourceInfo.url);
      expect(decoded.resource.description).toBe(mockResourceInfo.description);
    });

    test("encodes accepts array with CAIP-2 networks", () => {
      const encoded = encodePaymentRequiredV2(mockPaymentRequiredV2);
      const decoded = decodePaymentRequiredV2(encoded);

      expect(decoded.accepts).toHaveLength(1);
      expect(decoded.accepts[0].scheme).toBe("exact");
      expect(decoded.accepts[0].network).toBe("eip155:84532");
    });

    test("encodes extensions", () => {
      const encoded = encodePaymentRequiredV2(mockPaymentRequiredV2);
      const decoded = decodePaymentRequiredV2(encoded);

      expect(decoded.extensions).toBeDefined();
    });
  });

  describe("Decoding", () => {
    test("decodes Base64 payment required", () => {
      const encoded = encodePaymentRequiredV2(mockPaymentRequiredV2);
      const decoded = decodePaymentRequiredV2(encoded);

      expect(decoded.x402Version).toBe(2);
      expect(decoded.accepts).toBeDefined();
      expect(Array.isArray(decoded.accepts)).toBe(true);
    });

    test("preserves CAIP-2 network format", () => {
      const encoded = encodePaymentRequiredV2(mockPaymentRequiredV2);
      const decoded = decodePaymentRequiredV2(encoded);

      expect(decoded.accepts[0].network).toMatch(/^eip155:\d+$/);
    });
  });

  describe("Round-trip", () => {
    test("encoding and decoding preserves data integrity", () => {
      const encoded = encodePaymentRequiredV2(mockPaymentRequiredV2);
      const decoded = decodePaymentRequiredV2(encoded);

      expect(decoded).toEqual(mockPaymentRequiredV2);
    });

    test("handles multiple networks in accepts", () => {
      const multiAccepts: PaymentRequiredV2 = {
        x402Version: 2,
        resource: mockResourceInfo,
        accepts: [
          mockRequirementsV2,
          {
            ...mockRequirementsV2,
            network: "eip155:1", // Ethereum mainnet
            asset: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
          },
          {
            ...mockRequirementsV2,
            network: "eip155:137", // Polygon
            asset: "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174",
          },
        ],
      };

      const encoded = encodePaymentRequiredV2(multiAccepts);
      const decoded = decodePaymentRequiredV2(encoded);

      expect(decoded.accepts).toHaveLength(3);
      expect(decoded.accepts[0].network).toBe("eip155:84532");
      expect(decoded.accepts[1].network).toBe("eip155:1");
      expect(decoded.accepts[2].network).toBe("eip155:137");
    });
  });
});

// ============================================
// V2 Payment Signature Header Tests
// ============================================

describe("x402 V2 PAYMENT-SIGNATURE Header", () => {
  describe("Encoding", () => {
    test("encodes payment payload to Base64", () => {
      const encoded = encodePaymentPayloadV2(mockPaymentPayloadV2);

      expect(typeof encoded).toBe("string");
      expect(encoded.length).toBeGreaterThan(0);
    });

    test("includes x402Version: 2 in encoded payload", () => {
      const encoded = encodePaymentPayloadV2(mockPaymentPayloadV2);
      const decoded = decodePaymentPayloadV2(encoded);

      expect(decoded.x402Version).toBe(2);
    });

    test("includes resource echo", () => {
      const encoded = encodePaymentPayloadV2(mockPaymentPayloadV2);
      const decoded = decodePaymentPayloadV2(encoded);

      expect(decoded.resource).toEqual(mockResourceInfo);
    });

    test("includes accepted requirements", () => {
      const encoded = encodePaymentPayloadV2(mockPaymentPayloadV2);
      const decoded = decodePaymentPayloadV2(encoded);

      expect(decoded.accepted).toEqual(mockRequirementsV2);
    });

    test("includes scheme payload with signature", () => {
      const encoded = encodePaymentPayloadV2(mockPaymentPayloadV2);
      const decoded = decodePaymentPayloadV2(encoded);

      expect(decoded.payload.signature).toBe(mockSchemePayloadV2.signature);
      expect(decoded.payload.authorization).toEqual(mockAuthorizationV2);
    });
  });

  describe("Decoding", () => {
    test("decodes Base64 payment payload", () => {
      const encoded = encodePaymentPayloadV2(mockPaymentPayloadV2);
      const decoded = decodePaymentPayloadV2(encoded);

      expect(decoded.x402Version).toBe(2);
      expect(decoded.payload).toBeDefined();
    });

    test("preserves EIP-3009 authorization", () => {
      const encoded = encodePaymentPayloadV2(mockPaymentPayloadV2);
      const decoded = decodePaymentPayloadV2(encoded);

      expect(decoded.payload.authorization.from).toBe(mockAuthorizationV2.from);
      expect(decoded.payload.authorization.to).toBe(mockAuthorizationV2.to);
      expect(decoded.payload.authorization.value).toBe(mockAuthorizationV2.value);
      expect(decoded.payload.authorization.validAfter).toBe(mockAuthorizationV2.validAfter);
      expect(decoded.payload.authorization.validBefore).toBe(mockAuthorizationV2.validBefore);
      expect(decoded.payload.authorization.nonce).toBe(mockAuthorizationV2.nonce);
    });
  });

  describe("Round-trip", () => {
    test("encoding and decoding preserves payment payload integrity", () => {
      const encoded = encodePaymentPayloadV2(mockPaymentPayloadV2);
      const decoded = decodePaymentPayloadV2(encoded);

      expect(decoded).toEqual(mockPaymentPayloadV2);
    });
  });
});

// ============================================
// V2 Payment Response Header Tests
// ============================================

describe("x402 V2 PAYMENT-RESPONSE Header", () => {
  describe("Encoding", () => {
    test("encodes settlement response to Base64", () => {
      const encoded = encodeSettlementResponseV2(mockSettlementResponseV2);

      expect(typeof encoded).toBe("string");
      expect(encoded.length).toBeGreaterThan(0);
    });

    test("encodes success status", () => {
      const encoded = encodeSettlementResponseV2(mockSettlementResponseV2);
      const decoded = decodeSettlementResponseV2(encoded);

      expect(decoded.success).toBe(true);
    });

    test("encodes transaction hash", () => {
      const encoded = encodeSettlementResponseV2(mockSettlementResponseV2);
      const decoded = decodeSettlementResponseV2(encoded);

      expect(decoded.transaction).toBe(mockSettlementResponseV2.transaction);
    });

    test("encodes CAIP-2 network", () => {
      const encoded = encodeSettlementResponseV2(mockSettlementResponseV2);
      const decoded = decodeSettlementResponseV2(encoded);

      expect(decoded.network).toBe("eip155:84532");
    });

    test("encodes error reason for failed settlement", () => {
      const failedSettlement: SettlementResponseV2 = {
        success: false,
        errorReason: "Insufficient balance",
        transaction: "",
        network: "eip155:84532",
      };

      const encoded = encodeSettlementResponseV2(failedSettlement);
      const decoded = decodeSettlementResponseV2(encoded);

      expect(decoded.success).toBe(false);
      expect(decoded.errorReason).toBe("Insufficient balance");
    });

    test("encodes extensions", () => {
      const encoded = encodeSettlementResponseV2(mockSettlementResponseV2);
      const decoded = decodeSettlementResponseV2(encoded);

      expect(decoded.extensions).toBeDefined();
    });
  });

  describe("Decoding", () => {
    test("decodes Base64 settlement response", () => {
      const encoded = encodeSettlementResponseV2(mockSettlementResponseV2);
      const decoded = decodeSettlementResponseV2(encoded);

      expect(decoded.success).toBe(true);
      expect(decoded.network).toMatch(/^eip155:\d+$/);
    });
  });

  describe("Round-trip", () => {
    test("encoding and decoding preserves settlement response integrity", () => {
      const encoded = encodeSettlementResponseV2(mockSettlementResponseV2);
      const decoded = decodeSettlementResponseV2(encoded);

      expect(decoded).toEqual(mockSettlementResponseV2);
    });

    test("handles failed settlement without payer", () => {
      const failedSettlement: SettlementResponseV2 = {
        success: false,
        errorReason: "Invalid signature",
        transaction: "",
        network: "eip155:84532",
      };

      const encoded = encodeSettlementResponseV2(failedSettlement);
      const decoded = decodeSettlementResponseV2(encoded);

      expect(decoded).toEqual(failedSettlement);
      expect(decoded.payer).toBeUndefined();
    });
  });
});

// ============================================
// V2 Type Guards Tests
// ============================================

describe("x402 V2 Type Guards", () => {
  describe("isPaymentRequiredV2", () => {
    test("returns true for valid V2 payment required", () => {
      expect(isPaymentRequiredV2(mockPaymentRequiredV2)).toBe(true);
    });

    test("returns false for V1 payment required", () => {
      const v1PaymentRequired = {
        x402Version: 1,
        error: "Payment required",
        accepts: [],
      };
      expect(isPaymentRequiredV2(v1PaymentRequired)).toBe(false);
    });

    test("returns false for objects without x402Version", () => {
      expect(isPaymentRequiredV2({ resource: {}, accepts: [] })).toBe(false);
    });

    test("returns false for null", () => {
      expect(isPaymentRequiredV2(null)).toBe(false);
    });

    test("returns false for undefined", () => {
      expect(isPaymentRequiredV2(undefined)).toBe(false);
    });

    test("requires resource and accepts fields", () => {
      expect(isPaymentRequiredV2({ x402Version: 2 })).toBe(false);
      expect(isPaymentRequiredV2({ x402Version: 2, resource: {} })).toBe(false);
      expect(isPaymentRequiredV2({ x402Version: 2, accepts: [] })).toBe(false);
    });
  });

  describe("isPaymentPayloadV2", () => {
    test("returns true for valid V2 payment payload", () => {
      expect(isPaymentPayloadV2(mockPaymentPayloadV2)).toBe(true);
    });

    test("returns false for V1 payment payload", () => {
      const v1Payload = {
        x402Version: 1,
        scheme: "exact",
        network: "base",
        payload: {},
      };
      expect(isPaymentPayloadV2(v1Payload)).toBe(false);
    });

    test("returns false for objects missing required fields", () => {
      expect(isPaymentPayloadV2({ x402Version: 2 })).toBe(false);
      expect(isPaymentPayloadV2({ x402Version: 2, accepted: {} })).toBe(false);
    });

    test("requires accepted and payload fields", () => {
      expect(
        isPaymentPayloadV2({
          x402Version: 2,
          accepted: mockRequirementsV2,
          payload: mockSchemePayloadV2,
        })
      ).toBe(true);
    });
  });
});

// ============================================
// V2 Network Tests
// ============================================

describe("x402 V2 Network Support", () => {
  const networks: Array<{ name: string; chainId: number; caip2: string }> = [
    { name: "Ethereum Mainnet", chainId: 1, caip2: "eip155:1" },
    { name: "Ethereum Sepolia", chainId: 11155111, caip2: "eip155:11155111" },
    { name: "Base Mainnet", chainId: 8453, caip2: "eip155:8453" },
    { name: "Base Sepolia", chainId: 84532, caip2: "eip155:84532" },
    { name: "Polygon Mainnet", chainId: 137, caip2: "eip155:137" },
    { name: "Arbitrum One", chainId: 42161, caip2: "eip155:42161" },
    { name: "Arbitrum Sepolia", chainId: 421614, caip2: "eip155:421614" },
    { name: "Optimism Mainnet", chainId: 10, caip2: "eip155:10" },
    { name: "Optimism Sepolia", chainId: 11155420, caip2: "eip155:11155420" },
  ];

  test.each(networks)("supports $name with CAIP-2 $caip2", ({ caip2 }) => {
    const requirements: PaymentRequirementsV2 = {
      ...mockRequirementsV2,
      network: caip2 as CAIP2Network,
    };

    const paymentRequired: PaymentRequiredV2 = {
      x402Version: 2,
      resource: mockResourceInfo,
      accepts: [requirements],
    };

    const encoded = encodePaymentRequiredV2(paymentRequired);
    const decoded = decodePaymentRequiredV2(encoded);

    expect(decoded.accepts[0].network).toBe(caip2);
    expect(isCAIP2ChainId(decoded.accepts[0].network)).toBe(true);
  });
});

// ============================================
// V2 Edge Cases
// ============================================

describe("x402 V2 Edge Cases", () => {
  test("handles optional fields being omitted", () => {
    const minimalPaymentRequired: PaymentRequiredV2 = {
      x402Version: 2,
      resource: { url: "https://example.com" },
      accepts: [
        {
          scheme: "exact",
          network: "eip155:8453",
          amount: "1000000",
          asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
          payTo: "0x1234567890123456789012345678901234567890",
          maxTimeoutSeconds: 3600,
        },
      ],
    };

    const encoded = encodePaymentRequiredV2(minimalPaymentRequired);
    const decoded = decodePaymentRequiredV2(encoded);

    expect(decoded.x402Version).toBe(2);
    expect(decoded.error).toBeUndefined();
    expect(decoded.extensions).toBeUndefined();
    expect(decoded.resource.description).toBeUndefined();
  });

  test("handles large extension data", () => {
    const largeExtensions = {
      metadata: "x".repeat(1000),
      custom: Array.from({ length: 50 }, (_, i) => ({ id: i, value: `item-${i}` })),
    };

    const paymentRequired: PaymentRequiredV2 = {
      ...mockPaymentRequiredV2,
      extensions: largeExtensions,
    };

    const encoded = encodePaymentRequiredV2(paymentRequired);
    const decoded = decodePaymentRequiredV2(encoded);

    expect(decoded.extensions).toEqual(largeExtensions);
  });

  test("handles unicode in resource description", () => {
    const unicodeDescription = "Premium API \u4e2d\u6587 \u0420\u0443\u0441\u0441\u043a\u0438\u0439 \ud55c\uad6d\uc5b4";
    const paymentRequired: PaymentRequiredV2 = {
      ...mockPaymentRequiredV2,
      resource: {
        ...mockResourceInfo,
        description: unicodeDescription,
      },
    };

    const encoded = encodePaymentRequiredV2(paymentRequired);
    const decoded = decodePaymentRequiredV2(encoded);

    expect(decoded.resource.description).toBe(unicodeDescription);
  });

  test("handles very long transaction hashes", () => {
    const settlement: SettlementResponseV2 = {
      success: true,
      transaction: "0x" + "a".repeat(64),
      network: "eip155:8453",
      payer: "0x" + "1".repeat(40),
    };

    const encoded = encodeSettlementResponseV2(settlement);
    const decoded = decodeSettlementResponseV2(encoded);

    expect(decoded.transaction).toBe(settlement.transaction);
  });
});
