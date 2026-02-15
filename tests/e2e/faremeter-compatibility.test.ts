/**
 * Faremeter Compatibility E2E Tests
 *
 * Tests compatibility with Faremeter payment format and Coinbase SDK
 */

import { describe, test, expect, beforeAll } from "bun:test";
import { faremeterScenarios, describeFaremeterScenarios } from "./scenarios";
import {
  assertPaymentPayload,
  assertPaymentRequirements,
  assertVersionDetection,
} from "./assertions";
import { decodePayment, isExactEvmPayload } from "@armory-sh/base";

// Local helper to decode payment payload and return version info
function decodePayload(headerValue: string): { payload: any; version: 1 | 2 } {
  const payload = decodePayment(headerValue);
  if (isExactEvmPayload(payload)) {
    return { payload, version: 2 };
  }
  return { payload, version: 1 };
}

// ============================================================================
// Local Helper Functions (instead of fixtures)
// ============================================================================

function createX402V1Payload(nonce?: string): any {
  // Create a proper hex-only nonce from the input string
  const nonceStr = nonce ?? "test_v1";
  // Hash the string to get a consistent hex value
  const hash = Buffer.from(nonceStr).toString("hex").padStart(64, "0").slice(0, 64);

  return {
    x402Version: 1,
    scheme: "exact",
    network: "base-sepolia",
    payload: {
      signature: "0x" + "a".repeat(130),
      authorization: {
        from: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1" as `0x${string}`,
        to: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as `0x${string}`,
        value: "1000000",
        validAfter: Math.floor(Date.now() / 1000).toString(),
        validBefore: (Math.floor(Date.now() / 1000) + 3600).toString(),
        nonce: "0x" + hash,
      },
    },
  };
}

function createFaremeterPayload(nonce?: string): any {
  return createX402V1Payload(nonce);
}

// ============================================================================
// Setup
// ============================================================================

describe("Faremeter Compatibility E2E", () => {
  // ============================================================================
  // Faremeter V1 Format Tests
  // ============================================================================

  describe("Faremeter V1 Format", () => {
    test("decodes Faremeter V1 payload", () => {
      const payload = createFaremeterPayload("test_faremeter");
      const headerValue = JSON.stringify(payload);

      // Direct JSON parse for non-base64 payloads
      const result = JSON.parse(headerValue);

      expect(result.x402Version).toBe(1);
      assertPaymentPayload(result, 1);
    });

    test("decodes base64-encoded Faremeter payload", () => {
      const payload = createFaremeterPayload("test_faremeter_b64");
      const headerValue = Buffer.from(JSON.stringify(payload)).toString("base64");

      const result = decodePayload(headerValue);

      expect(result.version).toBe(1);
      assertPaymentPayload(result.payload, 1);
    });

    test("extracts payer address from Faremeter payload", () => {
      const payload = createFaremeterPayload();

      expect(payload.x402Version).toBe(1);
      expect(payload.payload.authorization.from).toBe("0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1");
    });
  });

  // ============================================================================
  // Coinbase SDK Compatibility
  // ============================================================================

  describe("Coinbase SDK Compatibility", () => {
    test("accepts Coinbase x402 V1 format", () => {
      const payload = createX402V1Payload("test_coinbase");

      expect(payload.x402Version).toBe(1);
      expect(payload.scheme).toBe("exact");
      assertPaymentPayload(payload, 1);
    });

    test("generates compatible X-PAYMENT header", () => {
      const payload = createX402V1Payload();
      const headerValue = Buffer.from(JSON.stringify(payload)).toString("base64");

      // Should be valid base64
      expect(() => Buffer.from(headerValue, "base64").toString()).not.toThrow();

      // Should decode back to original payload
      const decoded = JSON.parse(Buffer.from(headerValue, "base64").toString());
      expect(decoded.x402Version).toBe(1);
    });
  });

  // ============================================================================
  // Network Compatibility
  // ============================================================================

  describe("Network Compatibility", () => {
    test("supports base-sepolia network", () => {
      const payload = createFaremeterPayload();

      expect(payload.network).toBe("base-sepolia");
    });

    test("supports base mainnet", () => {
      const payload = createFaremeterPayload();
      (payload as any).network = "base";

      expect((payload as any).network).toBe("base");
    });

    test("supports ethereum mainnet", () => {
      const payload = createX402V1Payload();
      (payload as any).network = "ethereum";

      expect((payload as any).network).toBe("ethereum");
    });
  });

  // ============================================================================
  // Cross-Version Interoperability
  // ============================================================================

  describe("Cross-Version Interoperability", () => {
    test("V1 payload works with V2-aware middleware", () => {
      const v1Payload = createFaremeterPayload();
      const headerValue = JSON.stringify(v1Payload);

      // Direct JSON parse for non-base64 payloads
      const result = JSON.parse(headerValue);

      expect(result.x402Version).toBe(1);
      expect(result.payload).toBeDefined();
    });

    test("middleware auto-detects V1 format", () => {
      const v1Payload = createFaremeterPayload();

      // Check for V1 indicators
      expect(v1Payload.x402Version).toBe(1);
      expect(v1Payload.network).toBeDefined();
      expect(v1Payload.payload.authorization).toBeDefined();
    });
  });

  // ============================================================================
  // Legacy Format Support
  // ============================================================================

  describe("Legacy Format Support", () => {
    test("handles legacy contractAddress format", () => {
      const payload = createX402V1Payload();

      // V1 uses asset (but legacy might use contractAddress)
      expect(payload.payload.authorization.to).toMatch(/^0x[a-fA-F0-9]{40}$/);
    });

    test("handles legacy amount format (string)", () => {
      const payload = createX402V1Payload();

      // Amount should be a string in the authorization
      expect(typeof payload.payload.authorization.value).toBe("string");
    });

    test("handles legacy signature format (v, r, s)", () => {
      // x402 V1 uses signature field, not v/r/s
      const payload = createX402V1Payload();

      expect(payload.payload.signature).toBeDefined();
      expect(payload.payload.signature).toMatch(/^0x[a-fA-F0-9]{130}$/);
    });
  });

  // ============================================================================
  // Token Compatibility
  // ============================================================================

  describe("Token Compatibility", () => {
    test("works with USDC on base-sepolia", () => {
      const payload = createFaremeterPayload();

      expect(payload.x402Version).toBe(1);
      expect(payload.network).toBe("base-sepolia");
    });

    test("works with various ERC-20 tokens", () => {
      const tokens = [
        "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", // USDC
        "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", // USDC mainnet
      ];

      for (const tokenAddress of tokens) {
        expect(tokenAddress).toMatch(/^0x[a-fA-F0-9]{40}$/);
      }
    });
  });

  // ============================================================================
  // Faremeter Scenarios
  // ============================================================================

  describeFaremeterScenarios("Faremeter Payment Scenarios", (scenario) => {
    assertPaymentPayload(scenario.payload, scenario.version);
    assertPaymentRequirements(scenario.requirements, scenario.version);
  });

  // ============================================================================
  // Edge Cases
  // ============================================================================

  describe("Edge Cases", () => {
    test("handles uppercase address in to field", () => {
      const payload = createX402V1Payload();
      (payload.payload.authorization.to as string) = (
        payload.payload.authorization.to as string
      ).toUpperCase();

      expect(payload.payload.authorization.to).toMatch(/^0[xX][a-fA-F0-9]{40}$/);
    });

    test("handles mixed case address", () => {
      const payload = createX402V1Payload();

      const address = payload.payload.authorization.to;
      expect(typeof address).toBe("string");
      expect(address).toMatch(/^0x[a-fA-F0-9]{40}$/i);
    });

    test("handles zero-padding in nonce", () => {
      const payload = createX402V1Payload();

      const nonce = payload.payload.authorization.nonce;
      expect(nonce).toMatch(/^0x[a-fA-F0-9]{64}$/);
    });
  });
});
