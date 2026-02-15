/**
 * Express Middleware - Payment Utils Tests
 */

import { test, expect, describe } from "bun:test";
import {
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

const createX402V2Payload = () => ({
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
      nonce: `0x${Buffer.from("test_nonce").toString("hex").padStart(64, "0")}` as `0x${string}`,
    },
  },
});

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
