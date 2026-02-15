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

import { test, expect, describe } from "bun:test";
import {
  decodePayload,
  getHeadersForVersion,
  getRequirementsVersion,
  extractPayerAddress,
  createResponseHeaders,
} from "../src/payment-utils";
import { createX402V1Payload, createX402V2Payload } from "../../core/src/fixtures/payloads";
import { createX402V1Requirements, createX402V2Requirements } from "../../core/src/fixtures/requirements";

// ============================================================================
// getHeadersForVersion Tests
// ============================================================================

describe("[middleware-hono]: getHeadersForVersion", () => {
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

describe("[middleware-hono]: getRequirementsVersion", () => {
  test("returns V1 for V1 requirements", () => {
    const requirements = createX402V1Requirements();
    const version = getRequirementsVersion(requirements as any);
    expect(version).toBe(1);
  });

  test("returns V2 for V2 requirements", () => {
    const requirements = createX402V2Requirements();
    const version = getRequirementsVersion(requirements as any);
    expect(version).toBe(2);
  });
});

describe("[middleware-hono]: decodePayload", () => {
  test("decodes V1 payload from base64", () => {
    const payload = createX402V1Payload("test_nonce");
    const encoded = Buffer.from(JSON.stringify(payload)).toString("base64");
    const result = decodePayload(encoded);
    expect(result.version).toBe(1);
    expect(result.payload).toBeDefined();
  });

  test("decodes V2 payload from base64", () => {
    const payload = createX402V2Payload("test_nonce");
    const encoded = Buffer.from(JSON.stringify(payload)).toString("base64");
    const result = decodePayload(encoded);
    expect(result.version).toBe(2);
    expect(result.payload).toBeDefined();
  });

  test("throws on invalid payload", () => {
    expect(() => decodePayload("invalid")).toThrow();
  });
});

describe("[middleware-hono]: extractPayerAddress", () => {
  test("extracts from V1 payload", () => {
    const payload = createX402V1Payload("test_nonce");
    const address = extractPayerAddress(payload);
    expect(address).toBe("0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1");
  });

  test("extracts from V2 payload", () => {
    const payload = createX402V2Payload("test_nonce");
    const address = extractPayerAddress(payload);
    expect(address).toBe("0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1");
  });

  test("throws on unrecognized payload", () => {
    expect(() => extractPayerAddress({} as any)).toThrow();
  });
});

describe("[middleware-hono]: createResponseHeaders", () => {
  test("creates V1 response headers", () => {
    const headers = createResponseHeaders("0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1", 1);
    expect(headers["X-PAYMENT-RESPONSE"]).toBeDefined();
    const parsed = JSON.parse(headers["X-PAYMENT-RESPONSE"]!);
    expect(parsed.status).toBe("verified");
    expect(parsed.payerAddress).toBe("0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1");
    expect(parsed.version).toBe(1);
  });

  test("creates V2 response headers", () => {
    const headers = createResponseHeaders("0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1", 2);
    expect(headers["PAYMENT-RESPONSE"]).toBeDefined();
    const parsed = JSON.parse(headers["PAYMENT-RESPONSE"]!);
    expect(parsed.status).toBe("verified");
    expect(parsed.payerAddress).toBe("0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1");
    expect(parsed.version).toBe(2);
  });
});

