/**
 * Express Middleware Tests
 */

import { test, expect, describe } from "bun:test";
import { extractPayerAddress } from "../src/payment-utils";

describe("[middleware-express]: Express payment-utils", () => {
  test("extractPayerAddress from x402 V2", () => {
    const payload = {
      x402Version: 2,
      scheme: "exact",
      network: "eip155:84532",
      payload: {
        signature: `0x${"a".repeat(130)}`,
        authorization: { from: "0xtest" },
      },
    } as any;
    expect(extractPayerAddress(payload)).toBe("0xtest");
  });
});
