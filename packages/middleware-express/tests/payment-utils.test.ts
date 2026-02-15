/**
 * Express Middleware - Payment Utils Tests
 */

import { test, expect, describe } from "bun:test";
import {
  extractPayerAddress,
} from "../src/payment-utils";
import { createX402V2Payload } from "@armory-sh/base";

describe("[middleware-express]: extractPayerAddress", () => {
  test("extracts address from x402 V2 payload", () => {
    const payload = createX402V2Payload();
    const address = extractPayerAddress(payload as any);
    expect(address).toBe("0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1");
  });

  test("throws on invalid payload", () => {
    const invalid = { invalid: "payload" };
    expect(() => extractPayerAddress(invalid as any)).toThrow("Unable to extract payer address from payload");
  });
});
