/**
 * E2E Test Configuration
 *
 * Shared configuration for E2E tests including network configs and test keys.
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
// Test Timeouts
// ============================================================================

export const TEST_TIMEOUT_MS = 30000;
export const SERVER_STARTUP_DELAY_MS = 100;
export const SETTLEMENT_TIMEOUT_MS = 30000;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get a random port for test servers
 */
export const getRandomPort = (): number => 8800 + Math.floor(Math.random() * 200);

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

/**
 * Wait for transaction to settle on-chain
 */
export const waitForSettlement = async (txHash: string): Promise<void> => {
  // In a real test, this would poll the blockchain
  // For mock tests, just wait a bit
  await sleep(1000);
};
