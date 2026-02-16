/**
 * Mock Payment Payloads for Testing
 *
 * Provides test fixtures for:
 * - x402 V2 payloads (Coinbase compatible)
 */

import type {
  X402PaymentPayloadV2,
  PaymentRequirementsV2,
  SchemePayloadV2,
  EIP3009Authorization,
} from "@armory-sh/base";

// ============================================================================
// Test Keys (for testing signature verification)
// ============================================================================

export const TEST_PRIVATE_KEY = "0x0000000000000000000000000000000000000000001";
export const TEST_PUBLIC_KEY = "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1";
export const TEST_PAYER_ADDRESS = "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1" as const;
export const TEST_PAY_TO_ADDRESS = "0x1234567890123456789012345678901234567890" as const;
export const TEST_CONTRACT_ADDRESS = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48" as const;

// ============================================================================
// Default Payment Requirements
// ============================================================================

const DEFAULT_REQUIREMENTS: PaymentRequirementsV2 = {
  scheme: "exact",
  network: "eip155:84532",
  amount: "1000000",
  asset: TEST_CONTRACT_ADDRESS as `0x${string}`,
  payTo: TEST_PAY_TO_ADDRESS as `0x${string}`,
  maxTimeoutSeconds: 300,
};

// ============================================================================
// x402 V2 Payload (Coinbase compatible - with 'accepted' field)
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
  signature: "0x" + "b".repeat(130) as `0x${string}`,
  authorization: createV2Authorization(nonce),
});

export const createX402V2Payload = (
  nonce?: string,
  requirements?: Partial<PaymentRequirementsV2>
): X402PaymentPayloadV2 => ({
  x402Version: 2,
  accepted: { ...DEFAULT_REQUIREMENTS, ...requirements },
  payload: createV2SchemePayload(nonce ?? "test_v2_nonce"),
  resource: {
    url: "https://example.com/api/test",
    description: "Test resource",
  },
});

// ============================================================================
// Invalid/Malicious Payloads for Error Testing
// ============================================================================

export const INVALID_PAYLOADS = {
  missingFields: {} as any,
  invalidAddress: {
    x402Version: 2,
    accepted: DEFAULT_REQUIREMENTS,
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
