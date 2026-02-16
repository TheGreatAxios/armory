/**
 * Elysia Middleware - Payment Utils Tests
 */

import { test, expect, describe } from "bun:test";
import { extractPayerAddress } from "../src/payment-utils";

describe("[middleware-elysia]: Elysia payment-utils", () => {
  test("extractPayerAddress from x402 V2", () => {
    const payload = {
      x402Version: 2,
      scheme: "exact",
      network: "base",
      payload: {
        signature: "0x111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111b",
        authorization: {
          from: "0x1111111111111111111111111111111111111111",
          to: "0x2222222222222222222222222222222222222222",
          value: "1",
          validAfter: "0",
          validBefore: "9999999999",
          nonce: "0x0000000000000000000000000000000000000000000000000000000000000001",
        },
      },
    } as any;
    expect(extractPayerAddress(payload)).toBe("0x1111111111111111111111111111111111111111");
  });
});
