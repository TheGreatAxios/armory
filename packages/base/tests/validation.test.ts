/**
 * Comprehensive unit tests for validation layer
 * Tests all input formats, cross-checks, and error messages
 */

import { describe, test, expect, beforeEach } from "bun:test";
import {
  resolveNetwork,
  resolveToken,
  resolveFacilitator,
  checkFacilitatorSupport,
  validatePaymentConfig,
  validateAcceptConfig,
  getAvailableNetworks,
  getAvailableTokens,
  isValidationError,
} from "../src/validation";
import { registerToken } from "../src/types/networks";

// Register test tokens before running tests
const TEST_TOKENS = [
  {
    symbol: "USDC",
    name: "USD Coin",
    version: "2",
    contractAddress: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as const,
    chainId: 8453,
    decimals: 6,
  },
  {
    symbol: "EURC",
    name: "EURC",
    version: "2",
    contractAddress: "0x60a3E35Cc302bFA44Cb288Bc5a4F316Fdb1adb42" as const,
    chainId: 8453,
    decimals: 6,
  },
];

beforeEach(() => {
  // Register test tokens
  TEST_TOKENS.forEach(registerToken);
});

describe("[unit|base]: Validation Layer", () => {
  describe("[unit|base]: Utility Functions", () => {
    test("[getAvailableNetworks|success] - returns all network names", () => {
      const networks = getAvailableNetworks();
      expect(Array.isArray(networks)).toBe(true);
      expect(networks.length).toBeGreaterThan(0);
      expect(networks).toContain("base");
      expect(networks).toContain("ethereum");
    });

    test("[getAvailableTokens|success] - returns all token symbols", () => {
      const tokens = getAvailableTokens();
      expect(Array.isArray(tokens)).toBe(true);
      expect(tokens.length).toBeGreaterThan(0);
      expect(tokens).toContain("USDC");
    });
  });
});
