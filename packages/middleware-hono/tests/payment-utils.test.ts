/**
 * Hono Middleware - Payment Utils Tests
 *
 * Tests for:
 * - decodePayload
 * - encodeRequirements (via getRequirementsVersion)
 * - getHeadersForVersion
 * - extractPayerAddress
 * - createResponseHeaders
 */

import { test, expect, describe, beforeAll, afterAll } from "bun:test";
import {
  decodePayload,
  getHeadersForVersion,
  getRequirementsVersion,
  verifyWithFacilitator,
  extractPayerAddress,
  createResponseHeaders,
} from "../src/payment-utils";
import { createX402V1Payload, createX402V2Payload, createFaremeterPayload } from "../../core/src/fixtures/payloads";
import { createX402V1Requirements, createX402V2Requirements } from "../../core/src/fixtures/requirements";

// ============================================================================
// getHeadersForVersion Tests
// ============================================================================

describe("getHeadersForVersion", () => {
  test("returns V1 headers for version 1", () => {
    const headers = getHeadersForVersion(1);
    expect(headers.payment).toBe("X-PAYMENT");
    expect(headers.required).toBe("X-PAYMENT-REQUIRED");
    expect(headers.response).toBe("X-PAYMENT-RESPONSE");
  });

  test("returns V2 headers for version 2", () => {
    const headers = getHeadersForVersion(2);
    expect(headers.payment).toBe("PAYMENT-SIGNATURE");
    expect(headers.required).toBe("PAYMENT-REQUIRED");
    expect(headers.response).toBe("PAYMENT-RESPONSE");
  });
});

// ============================================================================
// getRequirementsVersion Tests
// ============================================================================

describe("getRequirementsVersion", () => {
  test("detects V1 requirements by contractAddress field", () => {
    const req = createX402V1Requirements();
    expect(getRequirementsVersion(req as any)).toBe(1);
  });

  test("detects V2 requirements by CAIP-2 network format", () => {
    const req = createX402V2Requirements();
    expect(getRequirementsVersion(req as any)).toBe(2);
  });
});

// ============================================================================
// decodePayload Tests
// ============================================================================

describe("decodePayload", () => {
  test("decodes x402 V1 JSON payload", () => {
    const payload = createX402V1Payload("test_decode_v1");
    const headerValue = JSON.stringify(payload);
    const result = decodePayload(headerValue);
    expect(result.version).toBe(1);
    expect(result.payload).toBeDefined();
    expect((result.payload as any).x402Version).toBe(1);
  });

  test("decodes x402 V1 base64 payload", () => {
    const payload = createX402V1Payload("test_decode_v1_b64");
    const headerValue = Buffer.from(JSON.stringify(payload)).toString("base64");
    const result = decodePayload(headerValue);
    expect(result.version).toBe(1);
    expect(result.payload).toBeDefined();
    expect((result.payload as any).x402Version).toBe(1);
  });

  test("decodes x402 V2 JSON payload", () => {
    const payload = createX402V2Payload("test_decode_v2");
    const headerValue = JSON.stringify(payload);
    const result = decodePayload(headerValue);
    expect(result.version).toBe(2);
    expect(result.payload).toBeDefined();
    expect((result.payload as any).x402Version).toBe(2);
  });

  test("decodes Faremeter payload", () => {
    const payload = createFaremeterPayload("test_decode_faremeter");
    const headerValue = JSON.stringify(payload);
    const result = decodePayload(headerValue);
    expect(result.version).toBe(1);
    expect(result.payload).toBeDefined();
    expect((result.payload as any).x402Version).toBe(1);
  });

  test("throws on invalid payload", () => {
    expect(() => decodePayload("not-valid-json")).toThrow("Invalid payment payload");
  });

  test("throws on unrecognized payload format", () => {
    const invalidPayload = { random: "data" };
    const headerValue = JSON.stringify(invalidPayload);
    expect(() => decodePayload(headerValue)).toThrow("Unrecognized payment payload format");
  });
});

// ============================================================================
// extractPayerAddress Tests
// ============================================================================

describe("extractPayerAddress", () => {
  test("extracts address from x402 V2 payload", () => {
    const payload = createX402V2Payload();
    const address = extractPayerAddress(payload as any);
    expect(address).toBe("0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1");
  });

  test("extracts address from Faremeter payload", () => {
    const payload = createFaremeterPayload();
    const address = extractPayerAddress(payload as any);
    expect(address).toBe("0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1");
  });

  test("extracts address from legacy V1 payload", () => {
    const legacyPayload = {
      from: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1",
      to: "0x1234567890123456789012345678901234567890",
      amount: "1000000",
      nonce: "test_nonce",
      expiry: Date.now() / 1000 + 3600,
      v: 27,
      r: "0x" + "d".repeat(64) as `0x${string}`,
      s: "0x" + "e".repeat(64) as `0x${string}`,
      chainId: 84532,
      contractAddress: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
      network: "base-sepolia",
    };
    const address = extractPayerAddress(legacyPayload as any);
    expect(address).toBe("0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1");
  });

  test("throws on invalid payload", () => {
    const invalid = { invalid: "payload" };
    expect(() => extractPayerAddress(invalid as any)).toThrow("Unable to extract payer address");
  });
});

// ============================================================================
// createResponseHeaders Tests
// ============================================================================

describe("createResponseHeaders", () => {
  test("creates V1 response headers", () => {
    const headers = createResponseHeaders("0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1" as any, 1);
    expect(headers["X-PAYMENT-RESPONSE"]).toBeDefined();
    const parsed = JSON.parse(headers["X-PAYMENT-RESPONSE"]!);
    expect(parsed.status).toBe("verified");
    expect(parsed.payerAddress).toBe("0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1");
    expect(parsed.version).toBe(1);
  });

  test("creates V2 response headers", () => {
    const headers = createResponseHeaders("0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1" as any, 2);
    expect(headers["PAYMENT-RESPONSE"]).toBeDefined();
    const parsed = JSON.parse(headers["PAYMENT-RESPONSE"]!);
    expect(parsed.status).toBe("verified");
    expect(parsed.payerAddress).toBe("0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1");
    expect(parsed.version).toBe(2);
  });
});
