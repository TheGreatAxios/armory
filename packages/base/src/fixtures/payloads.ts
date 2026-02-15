/**
 * Mock Payment Payloads for Testing (V2 Only)
 */

import type {
  X402PayloadV2,
  PaymentPayloadV2,
  SchemePayloadV2,
  EIP3009Authorization,
} from "@armory-sh/base";

// Test Keys
export const TEST_PRIVATE_KEY = "0x0000000000000000000000000000000000000000000000000000000000000000001";
export const TEST_PAYER_ADDRESS = "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1";
export const TEST_PAY_TO_ADDRESS = "0x1234567890123456789012345678901234567890";
export const TEST_CONTRACT_ADDRESS = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";

// x402 V2 Payload
const createV2Authorization = (nonce: string): EIP3009Authorization => ({
  from: TEST_PAYER_ADDRESS,
  to: TEST_PAY_TO_ADDRESS,
  value: "1000000",
  validAfter: Math.floor(Date.now() / 1000).toString(),
  validBefore: (Math.floor(Date.now() / 1000) + 3600).toString(),
  nonce: `0x${Buffer.from(nonce).toString("hex").padStart(64, "0")}`,
});

const createV2SchemePayload = (nonce: string): SchemePayloadV2 => ({
  signature: `0x${"b".repeat(130)}`,
  authorization: createV2Authorization(nonce),
});

export const createX402V2Payload = (nonce?: string): PaymentPayloadV2 => ({
  x402Version: 2,
  scheme: "exact",
  network: "eip155:84532",
  payload: createV2SchemePayload(nonce ?? "test_v2_nonce"),
  resource: {
    url: "https://example.com/api/test",
    description: "Test resource",
  },
});

// Legacy V2 Payload (from x402.ts - different format)
export const createLegacyV2Payload = (nonce?: string): X402PayloadV2 => ({
  from: TEST_PAYER_ADDRESS,
  to: TEST_PAY_TO_ADDRESS,
  amount: "1000000",
  nonce: nonce ?? "test_legacy_v2_nonce",
  expiry: Math.floor(Date.now() / 1000) + 3600,
  signature: {
    v: 27,
    r: `0x${"f".repeat(64)}`,
    s: `0x${"0".repeat(64)}`,
  },
  chainId: "eip155:84532",
  assetId: `eip155:84532/erc20:${TEST_CONTRACT_ADDRESS.slice(2)}`,
});

// Invalid payloads for error testing
export const INVALID_PAYLOADS = {
  missingFields: {},
  invalidAddress: {
    x402Version: 2,
    scheme: "exact",
    network: "eip155:84532",
    payload: {
      signature: `0x${"i".repeat(130)}`,
      authorization: {
        from: "not-an-address" as `0x${string}`,
        to: TEST_PAY_TO_ADDRESS,
        value: "1000000",
        validAfter: Math.floor(Date.now() / 1000).toString(),
        validBefore: (Math.floor(Date.now() / 1000) + 3600).toString(),
        nonce: `0x${"1".repeat(64)}`,
      },
    },
  } as PaymentPayloadV2,
  expired: (() => {
    const payload = createX402V2Payload("test_expired_nonce");
    (payload.payload.authorization as any).validBefore = (Math.floor(Date.now() / 1000) - 100).toString();
    return payload;
  })(),
  malformedSignature: (() => {
    const payload = createX402V2Payload("test_malformed_sig_nonce");
    (payload.payload as any).signature = "not-hex";
    return payload;
  })(),
} as const;
