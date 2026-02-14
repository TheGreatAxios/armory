/**
 * Express Middleware Tests
 */

import { test, expect, describe } from "bun:test";
import { getHeadersForVersion, extractPayerAddress } from "../src/payment-utils";

describe("Express payment-utils", () => {
  test("getHeadersForVersion returns V2 headers", () => {
    const headers = getHeadersForVersion(2);
    expect(headers.payment).toBe("PAYMENT-SIGNATURE");
  });

  test("extractPayerAddress from x402 V2", () => {
    const payload = {
      x402Version: 2,
      payload: { authorization: { from: "0xtest" } },
    } as any;
    expect(extractPayerAddress(payload)).toBe("0xtest");
  });
});
