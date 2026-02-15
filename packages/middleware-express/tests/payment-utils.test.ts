/**
 * Express Middleware - Payment Utils Tests
 */

import { test, expect, describe } from "bun:test";
import {
  decodePayload,
  getHeadersForVersion,
  getRequirementsVersion,
  extractPayerAddress,
} from "../src/payment-utils";
import { createX402V2Payload } from "../../core/src/fixtures/payloads";
import { createX402V2Requirements } from "../../core/src/fixtures/requirements";

describe("[middleware-express]: getHeadersForVersion", () => {
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

describe("[middleware-express]: decodePayload", () => {
  test("decodes x402 V2 JSON payload", () => {
    const payload = createX402V2Payload("test_express_decode");
    const headerValue = Buffer.from(JSON.stringify(payload)).toString('base64');
    const result = decodePayload(headerValue);

    expect(result.version).toBe(2);
    expect(result.payload).toBeDefined();
  });

  test("throws on invalid payload", () => {
    expect(() => decodePayload("not-valid-json")).toThrow("Invalid payment payload");
  });
});

describe("[middleware-express]: extractPayerAddress", () => {
  test("extracts address from x402 V2 payload", () => {
    const payload = createX402V2Payload();
    const address = extractPayerAddress(payload as any);
    expect(address).toBe("0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1");
  });

  test("throws on invalid payload", () => {
    const invalid = { invalid: "payload" };
    expect(() => extractPayerAddress(invalid as any)).toThrow("Unable to extract payer address");
  });
});

declare global {
  interface String {
    repeat(count: number): string;
  }
}
