/**
 * Mock Payment Requirements for Testing
 *
 * Provides test fixtures for:
 * - x402 V1 requirements (Coinbase compatible)
 * - x402 V2 requirements (Coinbase compatible)
 * - Legacy Armory V1/V2 requirements
 */

import type {
  X402PaymentRequirementsV1,
  PaymentRequirementsV2,
  PaymentRequirementsV1,
  PaymentRequirementsV2,
} from "@armory-sh/base";

// ============================================================================
// Test Keys (for testing signature verification)
// ============================================================================

export const TEST_PRIVATE_KEY = "0x0000000000000000000000000000000000000000000001";
export const TEST_PUBLIC_KEY = "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1";
export const TEST_PAYER_ADDRESS = "0x1234567890123456789012345678901234567890" as const;
export const TEST_PAY_TO_ADDRESS = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48" as const;
export const TEST_CONTRACT_ADDRESS = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48" as const;

// ============================================================================
// x402 V1 Requirements (Coinbase compatible)
// ============================================================================

export const MOCK_X402_V1_REQUIREMENTS: X402PaymentRequirementsV1 = {
  scheme: "exact",
  network: "base-sepolia",
  maxAmountRequired: "1000000",
  asset: TEST_CONTRACT_ADDRESS,
  payTo: TEST_PAY_TO_ADDRESS,
  resource: "https://example.com/api/test",
  description: "Test payment requirement",
  mimeType: "application/json",
  maxTimeoutSeconds: 300,
};

export const createX402V1Requirements = (
  overrides?: Partial<X402PaymentRequirementsV1>
): X402PaymentRequirementsV1 => ({
  ...MOCK_X402_V1_REQUIREMENTS,
  ...overrides,
});

// ============================================================================
// x402 V2 Requirements (Coinbase compatible)
// ============================================================================

export const MOCK_X402_V2_REQUIREMENTS: PaymentRequirementsV2 = {
  scheme: "exact",
  network: "eip155:84532",
  maxAmountRequired: "1000000",
  asset: TEST_CONTRACT_ADDRESS,
  payTo: TEST_PAY_TO_ADDRESS,
  maxTimeoutSeconds: 300,
};

export const createX402V2Requirements = (
  overrides?: Partial<PaymentRequirementsV2>
): PaymentRequirementsV2 => ({
  ...MOCK_X402_V2_REQUIREMENTS,
  ...overrides,
});

// ============================================================================
// Legacy Armory V1 Requirements
// ============================================================================

export const MOCK_LEGACY_V1_REQUIREMENTS: PaymentRequirementsV1 = {
  amount: "1000000",
  network: "base-sepolia",
  contractAddress: TEST_CONTRACT_ADDRESS,
  payTo: TEST_PAY_TO_ADDRESS,
  expiry: Math.floor(Date.now() / 1000 + 3600,
};

export const createLegacyV1Requirements = (
  overrides?: Partial<PaymentRequirementsV1>
): PaymentRequirementsV1 => ({
  ...MOCK_LEGACY_V1_REQUIREMENTS,
  ...overrides,
});

// ============================================================================
// Legacy Armory V2 Requirements
// ============================================================================

export const MOCK_LEGACY_V2_REQUIREMENTS: PaymentRequirementsV2 = {
  amount: "1000000",
  to: TEST_PAY_TO_ADDRESS,
  chainId: "eip155:84532",
  assetId: "eip155:84532/erc20:" + TEST_CONTRACT_ADDRESS.slice(2),
  nonce: "test_req_nonce_" + Date.now(),
  expiry: Math.floor(Date.now() / 1000 + 3600,
};
