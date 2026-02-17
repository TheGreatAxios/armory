/**
 * Hono Middleware - Payment Utils Tests
 *
 * Tests for:
 * - decodePayload
 * - extractPayerAddress
 * - createResponseHeaders
 */

import { describe, expect, test } from "bun:test";
import {
  createResponseHeaders,
  decodePayload,
  extractPayerAddress,
} from "../src/payment-utils";

const TEST_PAYER_ADDRESS = "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1";
const TEST_PAY_TO_ADDRESS = "0x1234567890123456789012345678901234567890";
const TEST_CONTRACT_ADDRESS = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";

const DEFAULT_REQUIREMENTS = {
  scheme: "exact" as const,
  network: "eip155:84532",
  amount: "1000000",
  asset: TEST_CONTRACT_ADDRESS as `0x${string}`,
  payTo: TEST_PAY_TO_ADDRESS as `0x${string}`,
  maxTimeoutSeconds: 300,
};

const createX402V2Payload = (nonce?: string) => ({
  x402Version: 2 as const,
  accepted: DEFAULT_REQUIREMENTS,
  payload: {
    signature: `0x${"b".repeat(130)}` as `0x${string}`,
    authorization: {
      from: TEST_PAYER_ADDRESS as `0x${string}`,
      to: TEST_PAY_TO_ADDRESS as `0x${string}`,
      value: "1000000",
      validAfter: Math.floor(Date.now() / 1000).toString(),
      validBefore: (Math.floor(Date.now() / 1000) + 3600).toString(),
      nonce: `0x${Buffer.from(nonce ?? "test_nonce")
        .toString("hex")
        .padStart(64, "0")}` as `0x${string}`,
    },
  },
});

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
    const headers = createResponseHeaders(
      "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1",
    );
    expect(headers["PAYMENT-RESPONSE"]).toBeDefined();
    const parsed = JSON.parse(headers["PAYMENT-RESPONSE"]!);
    expect(parsed.status).toBe("verified");
    expect(parsed.payerAddress).toBe(
      "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1",
    );
  });
});
