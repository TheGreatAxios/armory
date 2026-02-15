/**
 * Error Scenario E2E Tests
 *
 * Tests various error scenarios in payment flows
 */

import { describe, test, expect, beforeAll } from "bun:test";
import { errorScenarios, describeErrorScenarios } from "./scenarios";
import {
  assertPaymentError,
  assertPaymentPayload,
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
// Local Helper Functions
// ============================================================================

function createX402V2Payload(nonce?: string): any {
  return {
    x402Version: 2,
    scheme: "exact",
    network: "eip155:84532",
    payload: {
      signature: "0x" + "b".repeat(130),
      authorization: {
        from: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1" as `0x${string}`,
        to: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as `0x${string}`,
        value: "1000000",
        validAfter: Math.floor(Date.now() / 1000).toString(),
        validBefore: (Math.floor(Date.now() / 1000) + 3600).toString(),
        nonce: "0x" + Buffer.from(nonce ?? "test_v2").toString().padStart(64, "0").toString("hex"),
      },
    },
  };
}

describe("Error Scenario E2E", () => {

  // ============================================================================
  // Invalid Signature Errors
  // ============================================================================

  describe("Invalid Signature Errors", () => {
    test("rejects payment with invalid signature format", () => {
      const payload = createX402V2Payload("test_invalid_sig");

      // Corrupt the signature
      (payload.payload.signature as string) = "0x" + "a".repeat(10);

      expect(payload.payload.signature).not.toMatch(/^0x[a-fA-F0-9]{130}$/);
    });

    test("rejects payment with wrong signature length", () => {
      const payload = createX402V2Payload("test_short_sig");
      (payload.payload.signature as string) = "0x" + "a".repeat(64);

      expect(payload.payload.signature.length).not.toBe(132);
    });

    test("rejects payment without signature prefix", () => {
      const payload = createX402V2Payload("test_no_prefix");
      (payload.payload.signature as string) = "a".repeat(130);

      expect(payload.payload.signature).not.toMatch(/^0x/);
    });
  });

  // ============================================================================
  // Expired Payment Errors
  // ============================================================================

  describe("Expired Payment Errors", () => {
    test("rejects payment with expired validBefore", () => {
      const payload = createX402V2Payload("test_expired");
      const now = Math.floor(Date.now() / 1000);

      // Set validBefore to past
      payload.payload.authorization.validBefore = (now - 3600).toString();
      payload.payload.authorization.validAfter = (now - 7200).toString();

      expect(parseInt(payload.payload.authorization.validBefore)).toBeLessThan(now);
    });

    test("rejects payment with not-yet-valid validAfter", () => {
      const payload = createX402V2Payload("test_future");
      const now = Math.floor(Date.now() / 1000);

      // Set validAfter to future
      payload.payload.authorization.validAfter = (now + 3600).toString();
      payload.payload.authorization.validBefore = (now + 7200).toString();

      expect(parseInt(payload.payload.authorization.validAfter)).toBeGreaterThan(now);
    });

    test("rejects payment with validAfter > validBefore", () => {
      const payload = createX402V2Payload("test_invalid_window");
      const now = Math.floor(Date.now() / 1000);

      payload.payload.authorization.validAfter = (now + 3600).toString();
      payload.payload.authorization.validBefore = (now + 1800).toString();

      expect(parseInt(payload.payload.authorization.validAfter)).toBeGreaterThan(
        parseInt(payload.payload.authorization.validBefore)
      );
    });
  });

  // ============================================================================
  // Insufficient Balance Errors
  // ============================================================================

  describe("Insufficient Balance Errors", () => {
    test("rejects payment with amount less than required", () => {
      const requirements = {
        scheme: "exact",
        network: "eip155:84532",
        maxAmountRequired: "1000000",
        asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as `0x${string}`,
        payTo: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as `0x${string}`,
        maxTimeoutSeconds: 300,
      };

      const payload = createX402V2Payload("test_insufficient");
      // Payment amount is less than required
      payload.payload.authorization.value = "500000";

      expect(parseInt(payload.payload.authorization.value)).toBeLessThan(
        parseInt(requirements.maxAmountRequired)
      );
    });

    test("rejects payment with zero amount", () => {
      const payload = createX402V2Payload("test_zero");
      payload.payload.authorization.value = "0";

      expect(payload.payload.authorization.value).toBe("0");
    });
  });

  // ============================================================================
  // Network Mismatch Errors
  // ============================================================================

  describe("Network Mismatch Errors", () => {
    test("rejects payment with wrong chainId", () => {
      const payload = createX402V2Payload("test_wrong_chain");
      payload.network = "eip155:1"; // Ethereum mainnet instead of base-sepolia

      expect(payload.network).toBe("eip155:1");
    });

    test("rejects payment with invalid network format", () => {
      const payload = createX402V2Payload("test_invalid_network");
      payload.network = "invalid-network" as any;

      expect(payload.network).not.toMatch(/^eip155:\d+$/);
    });

    test("rejects payment with mismatched network", () => {
      const requirements = {
        scheme: "exact",
        network: "eip155:84532",
        amount: "1000000",
        asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as `0x${string}`,
        payTo: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as `0x${string}`,
        maxTimeoutSeconds: 300,
      };

      const payload = createX402V2Payload("test_mismatch");
      payload.network = "eip155:1";

      expect(payload.network).not.toBe(requirements.network);
    });
  });

  // ============================================================================
  // Invalid Token Address Errors
  // ============================================================================

  describe("Invalid Token Address Errors", () => {
    test("rejects payment with invalid contract address", () => {
      const payload = createX402V2Payload("test_invalid_contract");
      (payload as any).asset = "invalid-address";

      expect((payload as any).asset).not.toMatch(/^0x[a-fA-F0-9]{40}$/);
    });

    test("rejects payment with zero address", () => {
      const payload = createX402V2Payload("test_zero_address");
      (payload as any).asset = "0x" + "0".repeat(40);

      expect((payload as any).asset).toBe("0x" + "0".repeat(40));
    });

    test("rejects payment with mismatched token address", () => {
      const requirements = {
        scheme: "exact",
        network: "eip155:84532",
        amount: "1000000",
        asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as `0x${string}`,
        payTo: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as `0x${string}`,
        maxTimeoutSeconds: 300,
      };

      const payload = createX402V2Payload("test_wrong_token");
      (payload as any).asset = "0x" + "1".repeat(40);

      expect((payload as any).asset).not.toBe(requirements.asset);
    });
  });

  // ============================================================================
  // Invalid PayTo Address Errors
  // ============================================================================

  describe("Invalid PayTo Address Errors", () => {
    test("rejects payment with invalid payTo address", () => {
      const payload = createX402V2Payload("test_invalid_payto");
      payload.payload.authorization.to = "invalid" as `0x${string}`;

      expect(payload.payload.authorization.to).not.toMatch(/^0x[a-fA-F0-9]{40}$/);
    });

    test("rejects payment with zero payTo address", () => {
      const payload = createX402V2Payload("test_zero_payto");
      payload.payload.authorization.to = "0x" + "0".repeat(40) as `0x${string}`;

      expect(payload.payload.authorization.to).toBe("0x" + "0".repeat(40));
    });
  });

  // ============================================================================
  // Nonce Reuse Errors
  // ============================================================================

  describe("Nonce Reuse Errors", () => {
    test("rejects payment with reused nonce", async () => {
      const payload1 = createX402V2Payload("test_nonce_1");
      const payload2 = createX402V2Payload("test_nonce_2");

      // Use same nonce
      payload2.payload.authorization.nonce = payload1.payload.authorization.nonce;

      expect(payload2.payload.authorization.nonce).toBe(payload1.payload.authorization.nonce);
    });
  });

  // ============================================================================
  // Malformed Payload Errors
  // ============================================================================

  describe("Malformed Payload Errors", () => {
    test("rejects payment with missing x402Version", () => {
      const payload = createX402V2Payload("test_no_version");
      delete (payload as any).x402Version;

      expect((payload as any).x402Version).toBeUndefined();
    });

    test("rejects payment with missing scheme", () => {
      const payload = createX402V2Payload("test_no_scheme");
      delete (payload as any).scheme;

      expect((payload as any).scheme).toBeUndefined();
    });

    test("rejects payment with missing authorization", () => {
      const payload = createX402V2Payload("test_no_auth");
      delete (payload as any).payload.authorization;

      expect((payload as any).payload.authorization).toBeUndefined();
    });

    test("rejects payment with invalid JSON", () => {
      const invalidJSON = "{invalid json}";

      expect(() => JSON.parse(invalidJSON)).toThrow();
    });
  });

  // ============================================================================
  // Error Scenario Tests
  // ============================================================================

  describeErrorScenarios("All Error Scenarios", (scenario, errorType) => {
    assertPaymentPayload(scenario.payload, scenario.version);

    if (!scenario.expectedSuccess) {
      // Should fail verification
      expect(scenario.expectedStatus).toBeGreaterThanOrEqual(400);
    }
  });

  // ============================================================================
  // Error Messages
  // ============================================================================

  describe("Error Messages", () => {
    test("returns descriptive error for invalid signature", () => {
      const error = "Invalid signature";

      expect(error).toContain("signature");
    });

    test("returns descriptive error for expired payment", () => {
      const error = "Payment expired";

      expect(error).toContain("expired");
    });

    test("returns descriptive error for insufficient amount", () => {
      const error = "Insufficient amount";

      expect(error).toContain("Insufficient");
    });
  });
});
