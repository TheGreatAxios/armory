/**
 * Mock Payment Requirements for Testing (V2 Only)
 */

import type { PaymentRequirementsV2 } from "@armory-sh/base";

import { TEST_PAY_TO_ADDRESS, TEST_CONTRACT_ADDRESS } from "./payloads";

// x402 V2 Requirements
export const MOCK_X402_V2_REQUIREMENTS: PaymentRequirementsV2 = {
  scheme: "exact",
  network: "eip155:84532",
  amount: "1000000",
  asset: TEST_CONTRACT_ADDRESS,
  payTo: TEST_PAY_TO_ADDRESS,
  maxTimeoutSeconds: 300,
};

export const createX402V2Requirements = (overrides?: Partial<PaymentRequirementsV2>): PaymentRequirementsV2 => ({
  ...MOCK_X402_V2_REQUIREMENTS,
  ...overrides,
});

// Invalid requirements for error testing
export const INVALID_REQUIREMENTS = {
  missingAmount: (() => {
    const req = { ...MOCK_X402_V2_REQUIREMENTS };
    delete (req as any).amount;
    return req;
  })(),
  invalidNetwork: {
    scheme: "exact" as const,
    network: "not-caip2-network" as `eip155:${string}`,
    amount: "1000000",
    asset: TEST_CONTRACT_ADDRESS,
    payTo: TEST_PAY_TO_ADDRESS,
    maxTimeoutSeconds: 300,
  },
  invalidAsset: {
    scheme: "exact" as const,
    network: "eip155:84532",
    amount: "1000000",
    asset: "not-an-address" as `0x${string}`,
    payTo: TEST_PAY_TO_ADDRESS,
    maxTimeoutSeconds: 300,
  },
} as const;
