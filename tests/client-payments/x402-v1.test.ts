/**
 * x402 V1 Protocol Compatibility Tests
 *
 * Tests V1 format:
 * - PAYMENT-REQUIRED header parsing (Base64 encoded, x402Version: 1)
 * - PAYMENT header generation
 * - PAYMENT-RESPONSE header parsing
 */

import { describe, test, expect } from "bun:test";
import {
  // V1 specific
  V1_HEADERS,
  encodeX402PaymentRequiredV1,
  decodeX402PaymentRequiredV1,
  encodeX402PaymentPayloadV1,
  decodeX402PaymentPayloadV1,
  encodeX402SettlementResponseV1,
  decodeX402SettlementResponseV1,
  isX402PaymentRequiredV1,
  isX402PaymentPayloadV1,
  isLegacyPaymentPayloadV1,
  type X402PaymentRequiredV1,
  type X402PaymentPayloadV1,
  type X402SettlementResponseV1,
  type X402PaymentRequirementsV1,
  type EIP3009AuthorizationV1,
  // Shared utilities
  safeBase64Encode,
  safeBase64Decode,
} from "@armory-sh/base";

// ============================================
// Test Fixtures
// ============================================

const mockRequirementsV1: X402PaymentRequirementsV1 = {
  scheme: "exact",
  network: "base-sepolia",
  maxAmountRequired: "1500000", // 1.5 USDC (6 decimals)
  asset: "0x036CbD53842c5426634e7929541eC2318f3dCF7e", // USDC on Base Sepolia
  payTo: "0x1234567890123456789012345678901234567890",
  resource: "https://api.example.com/data",
  description: "Premium API access",
  mimeType: "application/json",
  maxTimeoutSeconds: 3600,
  extra: {
    name: "USD Coin",
    version: "2",
  },
};

const mockAuthorizationV1: EIP3009AuthorizationV1 = {
  from: "0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B",
  to: "0x1234567890123456789012345678901234567890",
  value: "1500000",
  validAfter: "1700000000",
  validBefore: "1700003600",
  nonce: "0x0000000000000000000000000000000000000000000000000000000000000001",
};

const mockPaymentPayloadV1: X402PaymentPayloadV1 = {
  x402Version: 1,
  scheme: "exact",
  network: "base-sepolia",
  payload: {
    signature:
      "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1c",
    authorization: mockAuthorizationV1,
  },
};

const mockPaymentRequiredV1: X402PaymentRequiredV1 = {
  x402Version: 1,
  error: "Payment required",
  accepts: [mockRequirementsV1],
};

const mockSettlementResponseV1: X402SettlementResponseV1 = {
  success: true,
  transaction: "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
  network: "base-sepolia",
  payer: "0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B",
};

// ============================================
// V1 Header Constants Tests
// ============================================

describe("x402 V1 Headers", () => {
  test("V1 headers have correct names", () => {
    expect(V1_HEADERS.PAYMENT).toBe("X-PAYMENT");
    expect(V1_HEADERS.PAYMENT_RESPONSE).toBe("X-PAYMENT-RESPONSE");
    expect(V1_HEADERS.PAYMENT_REQUIRED).toBe("X-PAYMENT-REQUIRED");
  });

  test("V1 headers are distinct from V2 headers", () => {
    // V1 uses X-PAYMENT, V2 uses PAYMENT-SIGNATURE
    expect(V1_HEADERS.PAYMENT).not.toBe("PAYMENT-SIGNATURE");
    expect(V1_HEADERS.PAYMENT_REQUIRED).toBe("X-PAYMENT-REQUIRED");
  });
});

// ============================================
// V1 Payment Required Header Tests
// ============================================

describe("x402 V1 PAYMENT-REQUIRED Header", () => {
  describe("Encoding", () => {
    test("encodes payment required to Base64", () => {
      const encoded = encodeX402PaymentRequiredV1(mockPaymentRequiredV1);

      expect(typeof encoded).toBe("string");
      expect(encoded.length).toBeGreaterThan(0);

      // Verify it's valid Base64
      const decoded = Buffer.from(encoded, "base64").toString("utf-8");
      const parsed = JSON.parse(decoded);
      expect(parsed.x402Version).toBe(1);
    });

    test("includes x402Version: 1 in encoded payload", () => {
      const encoded = encodeX402PaymentRequiredV1(mockPaymentRequiredV1);
      const decoded = decodeX402PaymentRequiredV1(encoded);

      expect(decoded.x402Version).toBe(1);
    });

    test("encodes accepts array correctly", () => {
      const encoded = encodeX402PaymentRequiredV1(mockPaymentRequiredV1);
      const decoded = decodeX402PaymentRequiredV1(encoded);

      expect(decoded.accepts).toHaveLength(1);
      expect(decoded.accepts[0].scheme).toBe("exact");
      expect(decoded.accepts[0].network).toBe("base-sepolia");
      expect(decoded.accepts[0].maxAmountRequired).toBe("1500000");
    });

    test("encodes error message", () => {
      const paymentRequired: X402PaymentRequiredV1 = {
        x402Version: 1,
        error: "Insufficient funds",
        accepts: [mockRequirementsV1],
      };

      const encoded = encodeX402PaymentRequiredV1(paymentRequired);
      const decoded = decodeX402PaymentRequiredV1(encoded);

      expect(decoded.error).toBe("Insufficient funds");
    });

    test("handles multiple payment options in accepts", () => {
      const multiPaymentRequired: X402PaymentRequiredV1 = {
        x402Version: 1,
        error: "Payment required",
        accepts: [
          mockRequirementsV1,
          {
            ...mockRequirementsV1,
            network: "ethereum",
            asset: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
          },
        ],
      };

      const encoded = encodeX402PaymentRequiredV1(multiPaymentRequired);
      const decoded = decodeX402PaymentRequiredV1(encoded);

      expect(decoded.accepts).toHaveLength(2);
      expect(decoded.accepts[0].network).toBe("base-sepolia");
      expect(decoded.accepts[1].network).toBe("ethereum");
    });
  });

  describe("Decoding", () => {
    test("decodes Base64 payment required", () => {
      const encoded = encodeX402PaymentRequiredV1(mockPaymentRequiredV1);
      const decoded = decodeX402PaymentRequiredV1(encoded);

      expect(decoded.x402Version).toBe(1);
      expect(decoded.accepts).toBeDefined();
      expect(Array.isArray(decoded.accepts)).toBe(true);
    });

    test("preserves all payment requirement fields", () => {
      const encoded = encodeX402PaymentRequiredV1(mockPaymentRequiredV1);
      const decoded = decodeX402PaymentRequiredV1(encoded);
      const req = decoded.accepts[0];

      expect(req.scheme).toBe(mockRequirementsV1.scheme);
      expect(req.network).toBe(mockRequirementsV1.network);
      expect(req.maxAmountRequired).toBe(mockRequirementsV1.maxAmountRequired);
      expect(req.asset).toBe(mockRequirementsV1.asset);
      expect(req.payTo).toBe(mockRequirementsV1.payTo);
      expect(req.resource).toBe(mockRequirementsV1.resource);
      expect(req.description).toBe(mockRequirementsV1.description);
      expect(req.maxTimeoutSeconds).toBe(mockRequirementsV1.maxTimeoutSeconds);
    });

    test("handles extra fields in requirements", () => {
      const encoded = encodeX402PaymentRequiredV1(mockPaymentRequiredV1);
      const decoded = decodeX402PaymentRequiredV1(encoded);

      expect(decoded.accepts[0].extra).toBeDefined();
      expect(decoded.accepts[0].extra?.name).toBe("USD Coin");
      expect(decoded.accepts[0].extra?.version).toBe("2");
    });
  });

  describe("Round-trip", () => {
    test("encoding and decoding preserves data integrity", () => {
      const encoded = encodeX402PaymentRequiredV1(mockPaymentRequiredV1);
      const decoded = decodeX402PaymentRequiredV1(encoded);

      expect(decoded).toEqual(mockPaymentRequiredV1);
    });

    test("handles empty accepts array", () => {
      const emptyAccepts: X402PaymentRequiredV1 = {
        x402Version: 1,
        error: "No payment methods available",
        accepts: [],
      };

      const encoded = encodeX402PaymentRequiredV1(emptyAccepts);
      const decoded = decodeX402PaymentRequiredV1(encoded);

      expect(decoded.accepts).toHaveLength(0);
    });
  });
});

// ============================================
// V1 Payment Header Tests
// ============================================

describe("x402 V1 PAYMENT Header", () => {
  describe("Encoding", () => {
    test("encodes payment payload to Base64", () => {
      const encoded = encodeX402PaymentPayloadV1(mockPaymentPayloadV1);

      expect(typeof encoded).toBe("string");
      expect(encoded.length).toBeGreaterThan(0);
    });

    test("includes x402Version: 1 in encoded payload", () => {
      const encoded = encodeX402PaymentPayloadV1(mockPaymentPayloadV1);
      const decoded = decodeX402PaymentPayloadV1(encoded);

      expect(decoded.x402Version).toBe(1);
    });

    test("encodes scheme as exact", () => {
      const encoded = encodeX402PaymentPayloadV1(mockPaymentPayloadV1);
      const decoded = decodeX402PaymentPayloadV1(encoded);

      expect(decoded.scheme).toBe("exact");
    });

    test("encodes network correctly", () => {
      const encoded = encodeX402PaymentPayloadV1(mockPaymentPayloadV1);
      const decoded = decodeX402PaymentPayloadV1(encoded);

      expect(decoded.network).toBe("base-sepolia");
    });

    test("encodes authorization data", () => {
      const encoded = encodeX402PaymentPayloadV1(mockPaymentPayloadV1);
      const decoded = decodeX402PaymentPayloadV1(encoded);

      expect(decoded.payload.authorization.from).toBe(mockAuthorizationV1.from);
      expect(decoded.payload.authorization.to).toBe(mockAuthorizationV1.to);
      expect(decoded.payload.authorization.value).toBe(mockAuthorizationV1.value);
      expect(decoded.payload.authorization.nonce).toBe(mockAuthorizationV1.nonce);
    });

    test("encodes signature in payload", () => {
      const encoded = encodeX402PaymentPayloadV1(mockPaymentPayloadV1);
      const decoded = decodeX402PaymentPayloadV1(encoded);

      expect(decoded.payload.signature).toBe(mockPaymentPayloadV1.payload.signature);
      expect(decoded.payload.signature.startsWith("0x")).toBe(true);
    });
  });

  describe("Decoding", () => {
    test("decodes Base64 payment payload", () => {
      const encoded = encodeX402PaymentPayloadV1(mockPaymentPayloadV1);
      const decoded = decodeX402PaymentPayloadV1(encoded);

      expect(decoded.x402Version).toBe(1);
      expect(decoded.scheme).toBe("exact");
      expect(decoded.payload).toBeDefined();
    });

    test("preserves validAfter and validBefore timestamps", () => {
      const encoded = encodeX402PaymentPayloadV1(mockPaymentPayloadV1);
      const decoded = decodeX402PaymentPayloadV1(encoded);

      expect(decoded.payload.authorization.validAfter).toBe("1700000000");
      expect(decoded.payload.authorization.validBefore).toBe("1700003600");
    });

    test("preserves nonce as hex string", () => {
      const encoded = encodeX402PaymentPayloadV1(mockPaymentPayloadV1);
      const decoded = decodeX402PaymentPayloadV1(encoded);

      expect(decoded.payload.authorization.nonce).toMatch(/^0x[a-fA-F0-9]{64}$/);
    });
  });

  describe("Round-trip", () => {
    test("encoding and decoding preserves payment payload integrity", () => {
      const encoded = encodeX402PaymentPayloadV1(mockPaymentPayloadV1);
      const decoded = decodeX402PaymentPayloadV1(encoded);

      expect(decoded).toEqual(mockPaymentPayloadV1);
    });

    test("handles different networks", () => {
      const networks = ["base", "base-sepolia", "ethereum", "ethereum-sepolia", "polygon", "arbitrum", "optimism"];

      for (const network of networks) {
        const payload: X402PaymentPayloadV1 = {
          ...mockPaymentPayloadV1,
          network,
        };

        const encoded = encodeX402PaymentPayloadV1(payload);
        const decoded = decodeX402PaymentPayloadV1(encoded);

        expect(decoded.network).toBe(network);
      }
    });
  });
});

// ============================================
// V1 Payment Response Header Tests
// ============================================

describe("x402 V1 PAYMENT-RESPONSE Header", () => {
  describe("Encoding", () => {
    test("encodes settlement response to Base64", () => {
      const encoded = encodeX402SettlementResponseV1(mockSettlementResponseV1);

      expect(typeof encoded).toBe("string");
      expect(encoded.length).toBeGreaterThan(0);
    });

    test("encodes success status", () => {
      const encoded = encodeX402SettlementResponseV1(mockSettlementResponseV1);
      const decoded = decodeX402SettlementResponseV1(encoded);

      expect(decoded.success).toBe(true);
    });

    test("encodes transaction hash", () => {
      const encoded = encodeX402SettlementResponseV1(mockSettlementResponseV1);
      const decoded = decodeX402SettlementResponseV1(encoded);

      expect(decoded.transaction).toBe(mockSettlementResponseV1.transaction);
      expect(decoded.transaction.startsWith("0x")).toBe(true);
    });

    test("encodes payer address", () => {
      const encoded = encodeX402SettlementResponseV1(mockSettlementResponseV1);
      const decoded = decodeX402SettlementResponseV1(encoded);

      expect(decoded.payer).toBe(mockSettlementResponseV1.payer);
    });

    test("encodes error reason for failed settlement", () => {
      const failedSettlement: X402SettlementResponseV1 = {
        success: false,
        errorReason: "Insufficient balance",
        transaction: "",
        network: "base-sepolia",
        payer: "0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B",
      };

      const encoded = encodeX402SettlementResponseV1(failedSettlement);
      const decoded = decodeX402SettlementResponseV1(encoded);

      expect(decoded.success).toBe(false);
      expect(decoded.errorReason).toBe("Insufficient balance");
      expect(decoded.transaction).toBe("");
    });
  });

  describe("Decoding", () => {
    test("decodes Base64 settlement response", () => {
      const encoded = encodeX402SettlementResponseV1(mockSettlementResponseV1);
      const decoded = decodeX402SettlementResponseV1(encoded);

      expect(decoded.success).toBe(true);
      expect(decoded.transaction).toBeDefined();
      expect(decoded.network).toBe("base-sepolia");
    });

    test("preserves all settlement fields", () => {
      const encoded = encodeX402SettlementResponseV1(mockSettlementResponseV1);
      const decoded = decodeX402SettlementResponseV1(encoded);

      expect(decoded.success).toBe(mockSettlementResponseV1.success);
      expect(decoded.transaction).toBe(mockSettlementResponseV1.transaction);
      expect(decoded.network).toBe(mockSettlementResponseV1.network);
      expect(decoded.payer).toBe(mockSettlementResponseV1.payer);
    });
  });

  describe("Round-trip", () => {
    test("encoding and decoding preserves settlement response integrity", () => {
      const encoded = encodeX402SettlementResponseV1(mockSettlementResponseV1);
      const decoded = decodeX402SettlementResponseV1(encoded);

      expect(decoded).toEqual(mockSettlementResponseV1);
    });

    test("handles failed settlement without transaction", () => {
      const failedSettlement: X402SettlementResponseV1 = {
        success: false,
        errorReason: "Signature verification failed",
        transaction: "",
        network: "base-sepolia",
        payer: "0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B",
      };

      const encoded = encodeX402SettlementResponseV1(failedSettlement);
      const decoded = decodeX402SettlementResponseV1(encoded);

      expect(decoded).toEqual(failedSettlement);
    });
  });
});

// ============================================
// V1 Type Guards Tests
// ============================================

describe("x402 V1 Type Guards", () => {
  describe("isX402PaymentRequiredV1", () => {
    test("returns true for valid V1 payment required", () => {
      expect(isX402PaymentRequiredV1(mockPaymentRequiredV1)).toBe(true);
    });

    test("returns false for V2 payment required", () => {
      const v2PaymentRequired = {
        x402Version: 2,
        resource: { url: "https://example.com" },
        accepts: [],
      };
      expect(isX402PaymentRequiredV1(v2PaymentRequired)).toBe(false);
    });

    test("returns false for objects without x402Version", () => {
      expect(isX402PaymentRequiredV1({ accepts: [] })).toBe(false);
    });

    test("returns false for null", () => {
      expect(isX402PaymentRequiredV1(null)).toBe(false);
    });

    test("returns false for undefined", () => {
      expect(isX402PaymentRequiredV1(undefined)).toBe(false);
    });
  });

  describe("isX402PaymentPayloadV1", () => {
    test("returns true for valid V1 payment payload", () => {
      expect(isX402PaymentPayloadV1(mockPaymentPayloadV1)).toBe(true);
    });

    test("returns false for V2 payment payload", () => {
      const v2Payload = {
        x402Version: 2,
        accepted: {},
        payload: {},
      };
      expect(isX402PaymentPayloadV1(v2Payload)).toBe(false);
    });

    test("returns false for objects missing required fields", () => {
      expect(isX402PaymentPayloadV1({ x402Version: 1 })).toBe(false);
      expect(isX402PaymentPayloadV1({ x402Version: 1, scheme: "exact" })).toBe(false);
    });
  });

  describe("isLegacyPaymentPayloadV1", () => {
    test("returns true for legacy format with v, r, s", () => {
      const legacyPayload = {
        from: "0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B",
        to: "0x1234567890123456789012345678901234567890",
        amount: "1500000",
        nonce: "123",
        expiry: 1700003600,
        v: 28,
        r: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
        s: "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
        chainId: 8453,
        contractAddress: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
        network: "base",
      };
      expect(isLegacyPaymentPayloadV1(legacyPayload)).toBe(true);
    });

    test("returns false for x402 V1 format", () => {
      expect(isLegacyPaymentPayloadV1(mockPaymentPayloadV1)).toBe(false);
    });

    test("returns false for objects missing signature fields", () => {
      expect(isLegacyPaymentPayloadV1({ from: "0x...", to: "0x..." })).toBe(false);
    });
  });
});

// ============================================
// V1 Edge Cases and Error Handling
// ============================================

describe("x402 V1 Edge Cases", () => {
  test("handles large payment amounts", () => {
    const largeAmount = "999999999999999999999999";
    const requirements: X402PaymentRequirementsV1 = {
      ...mockRequirementsV1,
      maxAmountRequired: largeAmount,
    };

    const paymentRequired: X402PaymentRequiredV1 = {
      x402Version: 1,
      error: "Payment required",
      accepts: [requirements],
    };

    const encoded = encodeX402PaymentRequiredV1(paymentRequired);
    const decoded = decodeX402PaymentRequiredV1(encoded);

    expect(decoded.accepts[0].maxAmountRequired).toBe(largeAmount);
  });

  test("handles long descriptions and URLs", () => {
    const longDescription = "This is a very long description that tests the encoding of large strings in the payment requirements. It should be preserved correctly through the encoding and decoding process.";
    const longUrl = "https://api.example.com/v1/very/long/path/to/resource?query=param&another=value&more=data";

    const requirements: X402PaymentRequirementsV1 = {
      ...mockRequirementsV1,
      description: longDescription,
      resource: longUrl,
    };

    const paymentRequired: X402PaymentRequiredV1 = {
      x402Version: 1,
      error: "Payment required",
      accepts: [requirements],
    };

    const encoded = encodeX402PaymentRequiredV1(paymentRequired);
    const decoded = decodeX402PaymentRequiredV1(encoded);

    expect(decoded.accepts[0].description).toBe(longDescription);
    expect(decoded.accepts[0].resource).toBe(longUrl);
  });

  test("handles special characters in error messages", () => {
    const specialError = "Error: \"quotes\" and 'apostrophes' with \n newlines \t tabs";
    const paymentRequired: X402PaymentRequiredV1 = {
      x402Version: 1,
      error: specialError,
      accepts: [mockRequirementsV1],
    };

    const encoded = encodeX402PaymentRequiredV1(paymentRequired);
    const decoded = decodeX402PaymentRequiredV1(encoded);

    expect(decoded.error).toBe(specialError);
  });

  test("handles unicode in descriptions", () => {
    const unicodeDescription = "Payment for service \u4e2d\u6587 \u0420\u0443\u0441\u0441\u043a\u0438\u0439 \ud55c\uad6d\uc5b4";
    const requirements: X402PaymentRequirementsV1 = {
      ...mockRequirementsV1,
      description: unicodeDescription,
    };

    const paymentRequired: X402PaymentRequiredV1 = {
      x402Version: 1,
      error: "Payment required",
      accepts: [requirements],
    };

    const encoded = encodeX402PaymentRequiredV1(paymentRequired);
    const decoded = decodeX402PaymentRequiredV1(encoded);

    expect(decoded.accepts[0].description).toBe(unicodeDescription);
  });
});
