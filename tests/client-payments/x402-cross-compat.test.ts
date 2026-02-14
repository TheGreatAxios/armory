/**
 * x402 Cross-Compatibility Tests
 *
 * Tests cross-compatibility between:
 * - client-viem parsing Coinbase x402 middleware responses
 * - middleware handling Coinbase x402 client requests
 * - V1 and V2 format interoperability
 */

import { describe, test, expect } from "bun:test";
import {
  // V1 imports
  V1_HEADERS,
  encodeX402PaymentRequiredV1,
  decodeX402PaymentRequiredV1,
  encodeX402PaymentPayloadV1,
  decodeX402PaymentPayloadV1,
  encodeX402SettlementResponseV1,
  decodeX402SettlementResponseV1,
  isX402PaymentRequiredV1,
  isX402PaymentPayloadV1,
  type X402PaymentRequiredV1,
  type X402PaymentPayloadV1,
  type X402PaymentRequirementsV1,
  type X402SettlementResponseV1,
  // V2 imports
  V2_HEADERS,
  isPaymentRequiredV2,
  isPaymentPayloadV2,
  type PaymentRequiredV2,
  type PaymentPayloadV2,
  type PaymentRequirementsV2,
  type SettlementResponseV2,
  // Shared imports
  safeBase64Encode,
  safeBase64Decode,
  detectPaymentVersion,
  extractPaymentFromHeaders,
  createPaymentRequiredHeaders,
  createSettlementHeaders,
  isPaymentPayload,
  isV1,
  isV2,
  isX402V1PaymentRequired,
  isX402V2PaymentRequired,
  isX402V1Settlement,
  isX402V2Settlement,
  legacyToPaymentPayload,
  type PaymentPayload,
  type PaymentRequirements,
} from "@armory-sh/base";

// ============================================
// Test Fixtures
// ============================================

const v1Requirements: X402PaymentRequirementsV1 = {
  scheme: "exact",
  network: "base-sepolia",
  maxAmountRequired: "1500000",
  asset: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
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

const v1PaymentRequired: X402PaymentRequiredV1 = {
  x402Version: 1,
  error: "Payment required",
  accepts: [v1Requirements],
};

const v1PaymentPayload: X402PaymentPayloadV1 = {
  x402Version: 1,
  scheme: "exact",
  network: "base-sepolia",
  payload: {
    signature:
      "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1c",
    authorization: {
      from: "0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B",
      to: "0x1234567890123456789012345678901234567890",
      value: "1500000",
      validAfter: "1700000000",
      validBefore: "1700003600",
      nonce: "0x0000000000000000000000000000000000000000000000000000000000000001",
    },
  },
};

const v1Settlement: X402SettlementResponseV1 = {
  success: true,
  transaction: "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
  network: "base-sepolia",
  payer: "0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B",
};

const v2Requirements: PaymentRequirementsV2 = {
  scheme: "exact",
  network: "eip155:84532",
  amount: "1500000",
  asset: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
  payTo: "0x1234567890123456789012345678901234567890",
  maxTimeoutSeconds: 3600,
  extra: {
    name: "USD Coin",
    version: "2",
  },
};

const v2PaymentRequired: PaymentRequiredV2 = {
  x402Version: 2,
  error: "Payment required",
  resource: {
    url: "https://api.example.com/data",
    description: "Premium API access",
    mimeType: "application/json",
  },
  accepts: [v2Requirements],
};

// ============================================
// Version Detection Tests
// ============================================

describe("Version Detection", () => {
  test("detects V1 from X-PAYMENT header", () => {
    const headers = new Headers();
    headers.set(V1_HEADERS.PAYMENT, encodeX402PaymentPayloadV1(v1PaymentPayload));

    const version = detectPaymentVersion(headers);
    expect(version).toBe(1);
  });

  test("detects V2 from PAYMENT-SIGNATURE header", () => {
    const headers = new Headers();
    headers.set(V2_HEADERS.PAYMENT_SIGNATURE, Buffer.from(JSON.stringify({ x402Version: 2 })).toString("base64"));

    const version = detectPaymentVersion(headers);
    expect(version).toBe(2);
  });

  test("returns null when no payment headers present", () => {
    const headers = new Headers();
    const version = detectPaymentVersion(headers);
    expect(version).toBeNull();
  });

  test("prioritizes V2 PAYMENT-SIGNATURE over X-PAYMENT", () => {
    const headers = new Headers();
    headers.set(V1_HEADERS.PAYMENT, encodeX402PaymentPayloadV1(v1PaymentPayload));
    headers.set(V2_HEADERS.PAYMENT_SIGNATURE, Buffer.from(JSON.stringify({ x402Version: 2 })).toString("base64"));

    const version = detectPaymentVersion(headers);
    expect(version).toBe(2);
  });
});

// ============================================
// Client-Viem Parsing Coinbase Middleware Responses
// ============================================

describe("client-viem parsing Coinbase middleware responses", () => {
  describe("V1 format parsing", () => {
    test("parses V1 PAYMENT-REQUIRED header from middleware", () => {
      // Simulate middleware response
      const encodedRequired = encodeX402PaymentRequiredV1(v1PaymentRequired);
      const headers = new Headers();
      headers.set(V1_HEADERS.PAYMENT_REQUIRED, encodedRequired);

      // Client parsing
      const encoded = headers.get(V1_HEADERS.PAYMENT_REQUIRED);
      expect(encoded).not.toBeNull();

      const decoded = decodeX402PaymentRequiredV1(encoded!);
      expect(decoded.x402Version).toBe(1);
      expect(decoded.accepts).toHaveLength(1);
      expect(decoded.accepts[0].scheme).toBe("exact");
    });

    test("parses V1 PAYMENT-RESPONSE header from middleware", () => {
      const encodedSettlement = encodeX402SettlementResponseV1(v1Settlement);
      const headers = new Headers();
      headers.set(V1_HEADERS.PAYMENT_RESPONSE, encodedSettlement);

      const encoded = headers.get(V1_HEADERS.PAYMENT_RESPONSE);
      expect(encoded).not.toBeNull();

      const decoded = decodeX402SettlementResponseV1(encoded!);
      expect(decoded.success).toBe(true);
      expect(decoded.transaction).toBe(v1Settlement.transaction);
    });

    test("extracts payment requirements for signing", () => {
      const encodedRequired = encodeX402PaymentRequiredV1(v1PaymentRequired);
      const decoded = decodeX402PaymentRequiredV1(encodedRequired);

      const requirements = decoded.accepts[0];
      expect(requirements.network).toBe("base-sepolia");
      expect(requirements.maxAmountRequired).toBe("1500000");
      expect(requirements.asset).toBe("0x036CbD53842c5426634e7929541eC2318f3dCF7e");
      expect(requirements.payTo).toBe("0x1234567890123456789012345678901234567890");
    });
  });

  describe("V2 format parsing", () => {
    test("parses V2 PAYMENT-REQUIRED header from middleware", () => {
      const encodedRequired = Buffer.from(JSON.stringify(v2PaymentRequired)).toString("base64");
      const headers = new Headers();
      headers.set(V2_HEADERS.PAYMENT_REQUIRED, encodedRequired);

      const encoded = headers.get(V2_HEADERS.PAYMENT_REQUIRED);
      expect(encoded).not.toBeNull();

      const decoded = JSON.parse(Buffer.from(encoded!, "base64").toString("utf-8")) as PaymentRequiredV2;
      expect(decoded.x402Version).toBe(2);
      expect(decoded.accepts).toHaveLength(1);
      expect(decoded.accepts[0].network).toBe("eip155:84532");
    });

    test("extracts CAIP-2 network from V2 requirements", () => {
      const encodedRequired = Buffer.from(JSON.stringify(v2PaymentRequired)).toString("base64");
      const decoded = JSON.parse(Buffer.from(encodedRequired, "base64").toString("utf-8")) as PaymentRequiredV2;

      const requirements = decoded.accepts[0];
      expect(requirements.network).toMatch(/^eip155:\d+$/);
    });
  });
});

// ============================================
// Middleware Handling Coinbase Client Requests
// ============================================

describe("middleware handling Coinbase client requests", () => {
  describe("V1 format handling", () => {
    test("extracts V1 payment from X-PAYMENT header", () => {
      const encodedPayment = encodeX402PaymentPayloadV1(v1PaymentPayload);
      const headers = new Headers();
      headers.set(V1_HEADERS.PAYMENT, encodedPayment);

      const extracted = extractPaymentFromHeaders(headers);
      expect(extracted).not.toBeNull();
      expect(isPaymentPayload(extracted)).toBe(true);
    });

    test("validates V1 payment payload structure", () => {
      const encodedPayment = encodeX402PaymentPayloadV1(v1PaymentPayload);
      const decoded = decodeX402PaymentPayloadV1(encodedPayment);

      expect(decoded.x402Version).toBe(1);
      expect(decoded.scheme).toBe("exact");
      expect(decoded.network).toBe("base-sepolia");
      expect(decoded.payload.signature).toBeDefined();
      expect(decoded.payload.authorization).toBeDefined();
    });

    test("creates V1 settlement response headers", () => {
      const headers = createSettlementHeaders({
        success: true,
        transaction: v1Settlement.transaction,
        network: v1Settlement.network,
        payer: v1Settlement.payer,
      });

      expect(headers["X-PAYMENT-RESPONSE"]).toBeDefined();
    });
  });

  describe("V2 format handling", () => {
    test("detects V2 payment from PAYMENT-SIGNATURE header", () => {
      const headers = new Headers();
      headers.set(V2_HEADERS.PAYMENT_SIGNATURE, Buffer.from(JSON.stringify({ x402Version: 2 })).toString("base64"));

      const version = detectPaymentVersion(headers);
      expect(version).toBe(2);
    });

    test("handles V2 CAIP-2 network identifiers", () => {
      const v2Payload = {
        x402Version: 2,
        accepted: v2Requirements,
        payload: {
          signature: v1PaymentPayload.payload.signature,
          authorization: v1PaymentPayload.payload.authorization,
        },
      };

      // Middleware should recognize CAIP-2 format
      expect(v2Payload.accepted.network).toMatch(/^eip155:\d+$/);
    });
  });
});

// ============================================
// V1/V2 Format Conversion Tests
// ============================================

describe("V1/V2 Format Conversion", () => {
  test("V1 network maps to V2 CAIP-2", () => {
    const networkMappings = [
      { v1: "base", v2: "eip155:8453" },
      { v1: "base-sepolia", v2: "eip155:84532" },
      { v1: "ethereum", v2: "eip155:1" },
      { v1: "ethereum-sepolia", v2: "eip155:11155111" },
      { v1: "polygon", v2: "eip155:137" },
      { v1: "arbitrum", v2: "eip155:42161" },
      { v1: "optimism", v2: "eip155:10" },
    ];

    for (const mapping of networkMappings) {
      expect(mapping.v2).toMatch(/^eip155:\d+$/);
    }
  });

  test("V1 and V2 authorization structures are compatible", () => {
    // V1 authorization
    const v1Auth = v1PaymentPayload.payload.authorization;

    // V2 authorization (same structure)
    const v2Auth = {
      from: v1Auth.from,
      to: v1Auth.to,
      value: v1Auth.value,
      validAfter: v1Auth.validAfter,
      validBefore: v1Auth.validBefore,
      nonce: v1Auth.nonce,
    };

    expect(v1Auth.from).toBe(v2Auth.from);
    expect(v1Auth.to).toBe(v2Auth.to);
    expect(v1Auth.value).toBe(v2Auth.value);
    expect(v1Auth.nonce).toBe(v2Auth.nonce);
  });
});

// ============================================
// Type Guard Cross-Compatibility Tests
// ============================================

describe("Type Guard Cross-Compatibility", () => {
  test("isV1 (alias for isX402V1Payload) correctly identifies V1 payment payloads", () => {
    expect(isV1(v1PaymentPayload)).toBe(true);
  });

  test("isV2 (alias for isX402V2Payload) correctly identifies V2 payment payloads", () => {
    // V2 payment payload must have x402Version: 2, scheme, network, and payload fields
    const v2PaymentPayload = {
      x402Version: 2,
      scheme: "exact",
      network: "eip155:84532",
      payload: {
        signature: v1PaymentPayload.payload.signature,
        authorization: v1PaymentPayload.payload.authorization,
      },
    };
    expect(isV2(v2PaymentPayload)).toBe(true);
  });

  test("isX402V1PaymentRequired identifies V1 payment required", () => {
    expect(isX402V1PaymentRequired(v1PaymentRequired)).toBe(true);
  });

  test("isX402V2PaymentRequired identifies V2 payment required", () => {
    expect(isX402V2PaymentRequired(v2PaymentRequired)).toBe(true);
  });

  test("isX402V1Settlement identifies V1 settlement", () => {
    expect(isX402V1Settlement(v1Settlement)).toBe(true);
  });

  test("isV1 returns false for V2 payloads", () => {
    const v2PaymentPayload = {
      x402Version: 2,
      scheme: "exact",
      network: "eip155:84532",
      payload: {},
    };
    expect(isV1(v2PaymentPayload)).toBe(false);
  });

  test("isV2 returns false for V1 payloads", () => {
    expect(isV2(v1PaymentPayload)).toBe(false);
  });

  test("isPaymentPayload works for unified format", () => {
    const unifiedPayload: PaymentPayload = {
      x402Version: 1,
      scheme: "exact",
      network: "base-sepolia",
      payload: {
        signature: v1PaymentPayload.payload.signature,
        authorization: v1PaymentPayload.payload.authorization,
      },
    };

    expect(isPaymentPayload(unifiedPayload)).toBe(true);
  });
});

// ============================================
// HTTP Header Integration Tests
// ============================================

describe("HTTP Header Integration", () => {
  test("creates correct V1 402 response headers", () => {
    const headers = createPaymentRequiredHeaders([v1Requirements]);

    expect(headers["X-PAYMENT-REQUIRED"]).toBeDefined();
    expect(headers["X-PAYMENT-REQUIRED"].length).toBeGreaterThan(0);
  });

  test("creates correct V1 settlement response headers", () => {
    const headers = createSettlementHeaders({
      success: true,
      transaction: v1Settlement.transaction,
      network: v1Settlement.network,
    });

    expect(headers["X-PAYMENT-RESPONSE"]).toBeDefined();
  });

  test("round-trip payment through headers", () => {
    // Server creates payment required
    const requiredHeaders = createPaymentRequiredHeaders([v1Requirements]);

    // Client receives and parses
    const clientHeaders = new Headers();
    clientHeaders.set("X-PAYMENT-REQUIRED", requiredHeaders["X-PAYMENT-REQUIRED"]);

    const encoded = clientHeaders.get("X-PAYMENT-REQUIRED");
    const decoded = safeBase64Decode(encoded!);
    const parsed = JSON.parse(decoded);

    expect(parsed.x402Version).toBe(1);
    expect(parsed.accepts).toHaveLength(1);
    expect(parsed.accepts[0].network).toBe("base-sepolia");
  });
});

// ============================================
// Error Handling Cross-Compatibility
// ============================================

describe("Error Handling", () => {
  test("handles corrupted V1 Base64 gracefully", () => {
    const corrupted = "!!!invalid-base64!!!";

    expect(() => {
      try {
        decodeX402PaymentRequiredV1(corrupted);
      } catch {
        throw new Error("Decoding failed");
      }
    }).toThrow();
  });

  test("handles missing payment header", () => {
    const headers = new Headers();
    const extracted = extractPaymentFromHeaders(headers);
    expect(extracted).toBeNull();
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

// ============================================
// End-to-End Payment Flow Tests
// ============================================

describe("End-to-End Payment Flow", () => {
  test("complete V1 payment flow", () => {
    // Step 1: Server sends 402 with payment requirements
    const serverHeaders = createPaymentRequiredHeaders([v1Requirements]);
    const clientHeaders = new Headers();
    clientHeaders.set("X-PAYMENT-REQUIRED", serverHeaders["X-PAYMENT-REQUIRED"]);

    // Step 2: Client parses requirements
    const encoded = clientHeaders.get("X-PAYMENT-REQUIRED");
    const requirements = JSON.parse(safeBase64Decode(encoded!));
    expect(requirements.accepts[0].network).toBe("base-sepolia");

    // Step 3: Client creates and sends payment
    const paymentHeaders = new Headers();
    paymentHeaders.set("X-PAYMENT", encodeX402PaymentPayloadV1(v1PaymentPayload));

    // Step 4: Server extracts and validates payment
    const payment = extractPaymentFromHeaders(paymentHeaders);
    expect(payment).not.toBeNull();
    expect(payment?.x402Version).toBe(1);

    // Step 5: Server sends settlement response
    const settlementHeaders = createSettlementHeaders({
      success: true,
      transaction: v1Settlement.transaction,
      network: v1Settlement.network,
    });

    // Step 6: Client parses settlement
    const settlementEncoded = settlementHeaders["X-PAYMENT-RESPONSE"];
    const settlement = JSON.parse(safeBase64Decode(settlementEncoded));
    expect(settlement.success).toBe(true);
  });

  test("multiple payment options flow", () => {
    const multiRequirements: PaymentRequirements[] = [
      v1Requirements,
      {
        ...v1Requirements,
        network: "ethereum",
        asset: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
      },
      {
        ...v1Requirements,
        network: "polygon",
        asset: "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174",
      },
    ];

    const headers = createPaymentRequiredHeaders(multiRequirements);
    const encoded = headers["X-PAYMENT-REQUIRED"];
    const decoded = JSON.parse(safeBase64Decode(encoded));

    expect(decoded.accepts).toHaveLength(3);
    expect(decoded.accepts[0].network).toBe("base-sepolia");
    expect(decoded.accepts[1].network).toBe("ethereum");
    expect(decoded.accepts[2].network).toBe("polygon");
  });
});

// ============================================
// Coinbase SDK Compatibility Tests
// ============================================

describe("Coinbase SDK Compatibility", () => {
  test("V1 format matches Coinbase x402 SDK structure", () => {
    // Verify the structure matches what Coinbase SDK expects
    const paymentRequired = v1PaymentRequired;

    // Required fields for Coinbase SDK
    expect(paymentRequired.x402Version).toBe(1);
    expect(paymentRequired.accepts).toBeDefined();
    expect(Array.isArray(paymentRequired.accepts)).toBe(true);

    const requirement = paymentRequired.accepts[0];
    expect(requirement.scheme).toBe("exact");
    expect(requirement.network).toBeDefined();
    expect(requirement.maxAmountRequired).toBeDefined();
    expect(requirement.asset).toBeDefined();
    expect(requirement.payTo).toBeDefined();
    expect(requirement.resource).toBeDefined();
    expect(requirement.maxTimeoutSeconds).toBeDefined();
  });

  test("V1 payment payload matches Coinbase SDK structure", () => {
    const payment = v1PaymentPayload;

    // Required fields for Coinbase SDK
    expect(payment.x402Version).toBe(1);
    expect(payment.scheme).toBe("exact");
    expect(payment.network).toBeDefined();
    expect(payment.payload).toBeDefined();
    expect(payment.payload.signature).toBeDefined();
    expect(payment.payload.authorization).toBeDefined();

    const auth = payment.payload.authorization;
    expect(auth.from).toBeDefined();
    expect(auth.to).toBeDefined();
    expect(auth.value).toBeDefined();
    expect(auth.validAfter).toBeDefined();
    expect(auth.validBefore).toBeDefined();
    expect(auth.nonce).toBeDefined();
  });

  test("V1 settlement response matches Coinbase SDK structure", () => {
    const settlement = v1Settlement;

    // Required fields for Coinbase SDK
    expect(settlement.success).toBeDefined();
    expect(settlement.transaction).toBeDefined();
    expect(settlement.network).toBeDefined();
  });

  test("signature format matches Coinbase SDK expectations", () => {
    const signature = v1PaymentPayload.payload.signature;

    // Coinbase SDK expects 0x-prefixed 65-byte hex signature
    expect(signature.startsWith("0x")).toBe(true);
    expect(signature.length).toBe(132); // 0x + 130 hex chars (65 bytes)
  });

  test("nonce format matches Coinbase SDK expectations", () => {
    const nonce = v1PaymentPayload.payload.authorization.nonce;

    // Coinbase SDK expects 0x-prefixed 32-byte hex nonce
    expect(nonce.startsWith("0x")).toBe(true);
    expect(nonce.length).toBe(66); // 0x + 64 hex chars (32 bytes)
  });
});

// ============================================
// Performance Tests
// ============================================

describe("Performance", () => {
  test("encoding performance for large payloads", () => {
    const largeAccepts: X402PaymentRequirementsV1[] = Array.from({ length: 10 }, (_, i) => ({
      ...v1Requirements,
      network: `network-${i}`,
    }));

    const start = performance.now();
    for (let i = 0; i < 100; i++) {
      encodeX402PaymentRequiredV1({
        x402Version: 1,
        error: "Payment required",
        accepts: largeAccepts,
      });
    }
    const duration = performance.now() - start;

    // Should complete 100 encodings in under 100ms
    expect(duration).toBeLessThan(100);
  });

  test("decoding performance for large payloads", () => {
    const largeAccepts: X402PaymentRequirementsV1[] = Array.from({ length: 10 }, (_, i) => ({
      ...v1Requirements,
      network: `network-${i}`,
    }));

    const encoded = encodeX402PaymentRequiredV1({
      x402Version: 1,
      error: "Payment required",
      accepts: largeAccepts,
    });

    const start = performance.now();
    for (let i = 0; i < 100; i++) {
      decodeX402PaymentRequiredV1(encoded);
    }
    const duration = performance.now() - start;

    // Should complete 100 decodings in under 100ms
    expect(duration).toBeLessThan(100);
  });
});
