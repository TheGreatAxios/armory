/**
 * Elysia Middleware - Payment Utils Tests
 */

import { test, expect, describe } from "bun:test";
import { extractPayerAddress } from "../src/payment-utils";

describe("[middleware-elysia]: Elysia payment-utils", () => {
  test("extractPayerAddress from x402 V2", () => {
    const payload = {
      x402Version: 2,
      payload: { authorization: { from: "0xtest" } },
    } as any;
    expect(extractPayerAddress(payload)).toBe("0xtest");
  });
});
