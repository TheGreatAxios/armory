/**
 * Test Configuration
 *
 * Shared configuration for E2E tests including network configs,
 * test keys, and facilitator URLs.
 */

// ============================================================================
// Test Keys
// ============================================================================

export const TEST_PRIVATE_KEY = (process.env.TEST_PRIVATE_KEY ||
  "0x0000000000000000000000000000000000000000000000000000000000000000000001") as `0x${string}`;

export const TEST_PAYER_ADDRESS = "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1" as const;
export const TEST_PAY_TO_ADDRESS = "0x1234567890123456789012345678901234567890" as const;
export const TEST_CONTRACT_ADDRESS = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48" as const;

// ============================================================================
// Network Configuration
// ============================================================================

export const TEST_NETWORK = "base-sepolia" as const;
export const TEST_CHAIN_ID = 84532 as const;
export const TEST_CAIP2_NETWORK = "eip155:84532" as const;
export const TEST_ASSET_ID = "eip155:84532/erc20:0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48" as const;
export const TEST_AMOUNT = "1000000" as const; // 1 USDC (6 decimals)
export const TEST_AMOUNT_DECIMAL = "1.0" as const;

// ============================================================================
// Facilitator Configuration
// ============================================================================

export const FACILITATOR_URL = process.env.FACILITATOR_URL || "https://facilitator.payai.network";
export const MOCK_FACILITATOR_PORT = 8899;

// ============================================================================
// Test Timeouts
// ============================================================================

export const TEST_TIMEOUT_MS = 30000;
export const SERVER_STARTUP_DELAY_MS = 100;
export const SETTLEMENT_TIMEOUT_MS = 10000;

// ============================================================================
// RPC Configuration (for actual blockchain calls)
// ============================================================================

export const TEST_RPC_URL = process.env.TEST_RPC_URL || "https://sepolia.base.org";

// ============================================================================
// Payment Config (shared across tests)
// ============================================================================

export interface TestPaymentConfig {
  payTo: `0x${string}`;
  amount: string;
  network: string;
  defaultVersion: 1 | 2;
  accept: {
    networks: string[];
    tokens: string[];
    facilitators: Array<{ url: string }>;
  };
}

export const DEFAULT_PAYMENT_CONFIG: TestPaymentConfig = {
  payTo: TEST_PAY_TO_ADDRESS,
  amount: TEST_AMOUNT_DECIMAL,
  network: TEST_NETWORK,
  defaultVersion: 2,
  accept: {
    networks: [TEST_NETWORK],
    tokens: ["usdc"],
    facilitators: [{ url: FACILITATOR_URL }],
  },
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get a random port for test servers
 */
export const getRandomPort = (): number => 8800 + Math.floor(Math.random() * 1000);

/**
 * Create a test nonce with timestamp
 */
export const createTestNonce = (prefix: string): string =>
  `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

/**
 * Sleep for specified milliseconds
 */
export const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));
