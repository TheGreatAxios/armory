/**
 * Comprehensive unit tests for validation layer
 * Tests all input formats, cross-checks, and error messages
 */

import { beforeEach, describe, expect, test } from "bun:test";
import { registerToken } from "../src/types/networks";
import {
  getAvailableNetworks,
  getAvailableTokens,
  validateAcceptConfig,
} from "../src/validation";

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

  describe("[unit|base]: Accept Config", () => {
    test("[validateAcceptConfig|success] - resolves token on each selected network", () => {
      const result = validateAcceptConfig(
        {
          networks: ["base-sepolia", "skale-base-sepolia"],
          tokens: ["usdc"],
          version: 2,
        },
        "0x67110aecf9b46844937d849bdebd5b5e8d35e1f7",
        "1000000",
      );

      expect(result.success).toBe(true);
      if (!result.success) {
        return;
      }

      expect(result.config).toHaveLength(2);
      expect(
        result.config
          .map((item) => item.network.config.chainId)
          .sort((a, b) => a - b),
      ).toEqual([84532, 324705682]);
      expect(
        result.config
          .map((item) => item.token.network.config.chainId)
          .sort((a, b) => a - b),
      ).toEqual([84532, 324705682]);
    });
  });
});
