/**
 * Bun Middleware - Payment Utils Tests
 */

import { describe, expect, test } from "bun:test";
import type { X402PaymentPayload } from "@armory-sh/base";
import { extractPayerAddress } from "../src/payment-utils";

describe("[middleware-bun]: Bun payment-utils", () => {
  test("extractPayerAddress from x402 V2", () => {
    const payload: X402PaymentPayload = {
      x402Version: 2,
      scheme: "exact",
      network: "base",
      payload: {
        signature:
          "0x111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111b",
        authorization: {
          from: "0x1111111111111111111111111111111111111111",
          to: "0x2222222222222222222222222222222222222222",
          value: "1",
          validAfter: "0",
          validBefore: "9999999999",
          nonce:
            "0x0000000000000000000000000000000000000000000000000000000000000001",
        },
      },
    } as X402PaymentPayload;
    expect(extractPayerAddress(payload)).toBe(
      "0x1111111111111111111111111111111111111111",
    );
  });
});
