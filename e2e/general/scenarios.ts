/**
 * Common E2E Test Scenarios
 *
 * Reusable test scenarios for end-to-end testing of x402 payment flows.
 */

import { describe, test, type TestContext } from "bun:test";
import type {
  X402PaymentPayloadV1,
  X402PaymentPayloadV2,
  PaymentRequirementsV2,
  X402PaymentRequirementsV1,
} from "@armory-sh/base";

// ============================================================================
// Types
// ============================================================================

export interface PaymentScenario {
  name: string;
  description: string;
  version: 1 | 2;
  payload: X402PaymentPayloadV1 | X402PaymentPayloadV2;
  requirements: X402PaymentRequirementsV1 | PaymentRequirementsV2;
  expectedStatus: number;
  expectedSuccess: boolean;
}

export interface ClientTestContext {
  signer: any;
  walletAddress: string;
  testToken: {
    symbol: string;
    contractAddress: string;
    chainId: number;
    decimals: number;
  };
}

export interface MiddlewareTestContext {
  server: any;
  baseUrl: string;
  testRequirements: X402PaymentRequirementsV1 | PaymentRequirementsV2;
}

// ============================================================================
// Test Data Builders
// ============================================================================

export const buildV1Scenario = (overrides?: Partial<PaymentScenario>): PaymentScenario => ({
  name: "V1 Standard Payment",
  description: "Standard x402 V1 payment flow",
  version: 1,
  payload: {
    x402Version: 1,
    scheme: "exact",
    network: "base-sepolia",
    payload: {
      signature: "0x" + "a".repeat(130),
      authorization: {
        from: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1" as `0x${string}`,
        to: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as `0x${string}`,
        value: "1000000",
        validAfter: Math.floor(Date.now() / 1000).toString(),
        validBefore: (Math.floor(Date.now() / 1000) + 3600).toString(),
        nonce: "0x" + "0".repeat(64),
      },
    },
  },
  requirements: {
    scheme: "exact",
    network: "base-sepolia",
    maxAmountRequired: "1000000",
    asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as `0x${string}`,
    payTo: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as `0x${string}`,
    resource: "https://api.example.com/protected",
    description: "Test resource",
    maxTimeoutSeconds: 300,
  },
  expectedStatus: 200,
  expectedSuccess: true,
  ...overrides,
});

export const buildV2Scenario = (overrides?: Partial<PaymentScenario>): PaymentScenario => ({
  name: "V2 Standard Payment",
  description: "Standard x402 V2 payment flow",
  version: 2,
  payload: {
    x402Version: 2,
    accepted: {
      scheme: "exact",
      network: "eip155:84532",
      amount: "1000000",
      asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as `0x${string}`,
      payTo: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as `0x${string}`,
      maxTimeoutSeconds: 300,
    },
    payload: {
      signature: "0x" + "b".repeat(130),
      authorization: {
        from: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1" as `0x${string}`,
        to: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as `0x${string}`,
        value: "1000000",
        validAfter: Math.floor(Date.now() / 1000).toString(),
        validBefore: (Math.floor(Date.now() / 1000) + 3600).toString(),
        nonce: "0x" + "1".repeat(64),
      },
    },
  },
  requirements: {
    scheme: "exact",
    network: "eip155:84532",
    amount: "1000000",
    asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as `0x${string}`,
    payTo: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as `0x${string}`,
    maxTimeoutSeconds: 300,
  },
  expectedStatus: 200,
  expectedSuccess: true,
  ...overrides,
});

// ============================================================================
// Error Scenarios
// ============================================================================

export const errorScenarios = {
  invalidSignature: buildV2Scenario({
    name: "Invalid Signature",
    expectedSuccess: false,
    expectedStatus: 402,
  }),

  expiredPayment: buildV2Scenario({
    name: "Expired Payment",
    payload: {
      x402Version: 2,
      accepted: {
        scheme: "exact",
        network: "eip155:84532",
        amount: "1000000",
        asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as `0x${string}`,
        payTo: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as `0x${string}`,
        maxTimeoutSeconds: 300,
      },
      payload: {
        signature: "0x" + "b".repeat(130),
        authorization: {
          from: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1" as `0x${string}`,
          to: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as `0x${string}`,
          value: "1000000",
          validAfter: Math.floor(Date.now() / 1000 - 7200).toString(),
          validBefore: Math.floor(Date.now() / 1000 - 3600).toString(),
          nonce: "0x" + "2".repeat(64),
        },
      },
    },
    expectedSuccess: false,
    expectedStatus: 402,
  }),

  insufficientAmount: buildV2Scenario({
    name: "Insufficient Amount in Payload",
    payload: {
      x402Version: 2,
      accepted: {
        scheme: "exact",
        network: "eip155:84532",
        amount: "1000000",
        asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as `0x${string}`,
        payTo: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as `0x${string}`,
        maxTimeoutSeconds: 300,
      },
      payload: {
        signature: "0x" + "b".repeat(130),
        authorization: {
          from: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1" as `0x${string}`,
          to: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as `0x${string}`,
          value: "500000",
          validAfter: Math.floor(Date.now() / 1000).toString(),
          validBefore: (Math.floor(Date.now() / 1000) + 3600).toString(),
          nonce: "0x" + "3".repeat(64),
        },
      },
    },
    expectedSuccess: false,
    expectedStatus: 402,
  }),

  wrongNetwork: buildV2Scenario({
    name: "Wrong Network",
    payload: {
      x402Version: 2,
      accepted: {
        scheme: "exact",
        network: "eip155:1",
        amount: "1000000",
        asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as `0x${string}`,
        payTo: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as `0x${string}`,
        maxTimeoutSeconds: 300,
      },
      payload: {
        signature: "0x" + "b".repeat(130),
        authorization: {
          from: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1" as `0x${string}`,
          to: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as `0x${string}`,
          value: "1000000",
          validAfter: Math.floor(Date.now() / 1000).toString(),
          validBefore: (Math.floor(Date.now() / 1000) + 3600).toString(),
          nonce: "0x" + "4".repeat(64),
        },
      },
    },
    expectedSuccess: false,
    expectedStatus: 402,
  }),
};

// ============================================================================
// Faremeter/Legacy Scenarios
// ============================================================================

export const faremeterScenarios = {
  standardV1: buildV1Scenario({
    name: "Faremeter V1 Compatible",
    description: "Faremeter legacy V1 format",
  }),

  baseNetwork: buildV1Scenario({
    name: "Faremeter Base Network",
    description: "Faremeter on Base mainnet",
    payload: {
      x402Version: 1,
      scheme: "exact",
      network: "base",
      payload: {
        signature: "0x" + "c".repeat(130),
        authorization: {
          from: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1" as `0x${string}`,
          to: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as `0x${string}`,
          value: "1000000",
          validAfter: Math.floor(Date.now() / 1000).toString(),
          validBefore: (Math.floor(Date.now() / 1000) + 3600).toString(),
          nonce: "0x" + "5".repeat(64),
        },
      },
    },
    requirements: {
      scheme: "exact",
      network: "base",
      maxAmountRequired: "1000000",
      asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as `0x${string}`,
      payTo: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as `0x${string}`,
      resource: "https://api.example.com/protected",
      description: "Test resource",
      maxTimeoutSeconds: 300,
    },
  }),
};

// ============================================================================
// Test Suite Builders
// ============================================================================

export function describePaymentScenarios(
  suiteName: string,
  testFn: (scenario: PaymentScenario) => void | Promise<void>
) {
  const scenarios = [
    buildV1Scenario({ name: "V1 Standard Payment" }),
    buildV2Scenario({ name: "V2 Standard Payment" }),
  ];

  describe(suiteName, () => {
    for (const scenario of scenarios) {
      test(scenario.name, () => testFn(scenario));
    }
  });
}

export function describeErrorScenarios(
  suiteName: string,
  testFn: (scenario: PaymentScenario, errorType: string) => void | Promise<void>
) {
  describe(suiteName, () => {
    for (const [errorType, scenario] of Object.entries(errorScenarios)) {
      test(`${scenario.name} (${errorType})`, async () => {
        await testFn(scenario, errorType);
      });
    }
  });
}

export function describeFaremeterScenarios(
  suiteName: string,
  testFn: (scenario: PaymentScenario) => void | Promise<void>
) {
  describe(suiteName, () => {
    for (const [name, scenario] of Object.entries(faremeterScenarios)) {
      test(`${scenario.name} (${name})`, async () => {
        await testFn(scenario);
      });
    }
  });
}
