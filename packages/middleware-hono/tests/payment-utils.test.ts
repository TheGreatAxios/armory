/**
 * Hono Middleware - Payment Utils Tests
 *
 * Tests for:
 * - decodePayload
 * - extractPayerAddress
 * - createResponseHeaders
 */

import { test, expect, describe } from "bun:test";
import {
  decodePayload,
  extractPayerAddress,
  createResponseHeaders,
} from "../src/payment-utils";
import { createX402V2Payload } from "@armory-sh/base";

describe("[middleware-hono]: decodePayload", () => {
  test("decodes V2 payload from base64", () => {
    const payload = createX402V2Payload("test_nonce");
    const encoded = Buffer.from(JSON.stringify(payload)).toString("base64");
    const result = decodePayload(encoded);
    expect(result.payload).toBeDefined();
  });

  test("throws on invalid payload", () => {
    expect(() => decodePayload("invalid")).toThrow();
  });
});

describe("[middleware-hono]: extractPayerAddress", () => {
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
  test("creates V2 response headers", () => {
    const headers = createResponseHeaders("0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1");
    expect(headers["PAYMENT-RESPONSE"]).toBeDefined();
    const parsed = JSON.parse(headers["PAYMENT-RESPONSE"]!);
    expect(parsed.status).toBe("verified");
    expect(parsed.payerAddress).toBe("0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1");
  });
});
