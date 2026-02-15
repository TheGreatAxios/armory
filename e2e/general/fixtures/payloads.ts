/**
 * Mock Payment Payloads for Testing
 *
 * Provides test fixtures for:
 * - x402 V1 payloads (Coinbase compatible)
 * - x402 V2 payloads (Coinbase compatible)
 * - Faremeter payloads (nested structure)
 * - Legacy Armory V1/V2 payloads
 */

import type {
  X402PaymentPayloadV1,
  X402PaymentPayloadV2,
  PaymentPayloadV1,
  PaymentPayloadV2,
  X402SchemePayloadV1,
  SchemePayloadV2,
  EIP3009AuthorizationV1,
  EIP3009Authorization,
} from "@armory-sh/base";

// ============================================================================
// Test Keys (for testing signature verification)
// ============================================================================

export const TEST_PRIVATE_KEY = "0x0000000000000000000000000000000000000000001";
export const TEST_PUBLIC_KEY = "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1";
export const TEST_PAYER_ADDRESS = "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1" as const;
export const TEST_PAY_TO_ADDRESS = "0x123456789012345678901234567890" as const;
export const TEST_CONTRACT_ADDRESS = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48" as const;

// ============================================================================
// x402 V1 Payload (Coinbase compatible)
// ============================================================================

const createV1Authorization = (nonce: string): EIP3009AuthorizationV1 => ({
  from: TEST_PAYER_ADDRESS,
  to: TEST_PAY_TO_ADDRESS,
  value: "1000000",
  validAfter: Math.floor(Date.now() / 1000).toString(),
  validBefore: (Math.floor(Date.now() / 1000) + 3600).toString(),
  nonce: `0x${Buffer.from(nonce).toString("hex").padStart(64, "0")}` as `0x${string}`,
});

const createV1SchemePayload = (nonce: string): X402SchemePayloadV1 => ({
  signature: "0x" + "a".repeat(130) as `0x${string}`, // Mock 65-byte signature
  authorization: createV1Authorization(nonce),
});

export const createX402V1Payload = (nonce?: string): X402PaymentPayloadV1 => ({
  x402Version: 1,
  scheme: "exact",
  network: "base-sepolia",
  payload: createV1SchemePayload(nonce ?? "test_v1_nonce"),
});

// ============================================================================
// x402 V2 Payload (Coinbase compatible)
// ============================================================================

const createV2Authorization = (nonce: string): EIP3009Authorization => ({
  from: TEST_PAYER_ADDRESS,
  to: TEST_PAY_TO_ADDRESS,
  value: "1000000",
  validAfter: Math.floor(Date.now() / 1000).toString(),
  validBefore: (Math.floor(Date.now() / 1000) + 3600).toString(),
  nonce: `0x${Buffer.from(nonce).toString("hex").padStart(64, "0")}` as `0x${string}`,
});

const createV2SchemePayload = (nonce: string): SchemePayloadV2 => ({
  signature: "0x" + "b".repeat(130) as `0x${string}`, // Mock 65-byte signature
  authorization: createV2Authorization(nonce),
});

export const createX402V2Payload = (nonce?: string): X402PaymentPayloadV2 => ({
  x402Version: 2,
  scheme: "exact",
  network: "eip155:84532",
  payload: createV2SchemePayload(nonce ?? "test_v2_nonce"),
  resource: {
    url: "https://example.com/api/test",
    description: "Test resource",
  },
});

// ============================================================================
// Faremeter Payload (x402 V1 with nested structure)
// ============================================================================

export interface FaremeterPaymentPayload {
  x402Version: 1;
  scheme: string;
  network: string;
  asset: string;
  payload: {
    signature: `0x${string}`;
    authorization: {
      from: string;
      to: string;
      value: string;
      validAfter: string;
      validBefore: string;
      nonce: `0x${string}`;
    };
  };
}

export const createFaremeterPayload = (nonce?: string): FaremeterPaymentPayload => ({
  x402Version: 1,
  scheme: "exact",
  network: "base-sepolia",
  asset: "USDC",
  payload: {
    signature: "0x" + "c".repeat(130) as `0x${string}`,
    authorization: {
      from: TEST_PAYER_ADDRESS,
      to: TEST_PAY_TO_ADDRESS,
      value: "1000000",
      validAfter: Math.floor(Date.now() / 1000).toString(),
      validBefore: (Math.floor(Date.now() / 1000) + 3600).toString(),
      nonce: `0x${Buffer.from(nonce ?? "test_faremeter_nonce").toString("hex").padStart(64, "0")}`,
    },
  },
});

// ============================================================================
// Legacy Armory V1 Payload
// ============================================================================

export const createLegacyV1Payload = (nonce?: string): PaymentPayloadV1 => ({
  from: TEST_PAYER_ADDRESS,
  to: TEST_PAY_TO_ADDRESS,
  amount: "1000000",
  nonce: nonce ?? "test_legacy_v1_nonce",
  expiry: Math.floor(Date.now() / 1000) + 3600,
  v: 27,
  r: "0x" + "d".repeat(64) as `0x${string}`,
  s: "0x" + "e".repeat(64) as `0x${string}`,
  chainId: 84532,
  contractAddress: TEST_CONTRACT_ADDRESS,
  network: "base-sepolia",
});

// ============================================================================
// Legacy Armory V2 Payload
// ============================================================================

export const createLegacyV2Payload = (nonce?: string): PaymentPayloadV2 => ({
  from: TEST_PAYER_ADDRESS,
  to: TEST_PAY_TO_ADDRESS,
  amount: "1000000",
  nonce: nonce ?? "test_legacy_v2_nonce",
  expiry: Math.floor(Date.now() / 1000) + 3600,
  signature: {
    v: 27,
    r: "0x" + "f".repeat(64) as `0x${string}`,
    s: "0x" + "0".repeat(64) as `0x${string}`,
  },
  chainId: "eip155:84532",
  assetId: "eip155:84532/erc20:" + TEST_CONTRACT_ADDRESS.slice(2),
  network: "base-sepolia",
});

// ============================================================================
// Invalid/Malicious Payloads for Error Testing
// ============================================================================

export const INVALID_PAYLOADS = {
  missingFields: {} as any,
  invalidAddress: {
    x402Version: 2,
    scheme: "exact",
    network: "eip155:84532",
    payload: {
      signature: "0xinvalid" as `0x${string}`,
      authorization: {
        from: "not-an-address",
        to: TEST_PAY_TO_ADDRESS,
        value: "1000000",
        validAfter: Math.floor(Date.now() / 1000).toString(),
        validBefore: (Math.floor(Date.now() / 1000) + 3600).toString(),
        nonce: "0x" + "1".repeat(64) as `0x${string}`,
      },
    },
  } as X402PaymentPayloadV2,
  expired: (() => {
    const payload = createX402V2Payload("test_expired_nonce");
    (payload.payload.authorization as any).validBefore = (Math.floor(Date.now() / 1000) - 100).toString();
    return payload;
  })(),
  malformedSignature: (() => {
    const payload = createX402V2Payload("test_malformed_sig_nonce");
    (payload.payload.signature as any) = "not-hex";
    return payload;
  })(),
} as const;
