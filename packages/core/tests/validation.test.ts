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

describe("Validation Layer", () => {
  describe("Network Resolution", () => {
    test("resolves network by name (case-insensitive)", () => {
      const result = resolveNetwork("base");
      if (isValidationError(result)) {
        throw new Error(result.message);
      }
      expect(result.config.name).toBe("Base Mainnet");
      expect(result.config.chainId).toBe(8453);
      expect(result.caip2).toBe("eip155:8453");
    });

    test("resolves network by chain ID number", () => {
      const result = resolveNetwork(8453);
      if (isValidationError(result)) {
        throw new Error(result.message);
      }
      expect(result.config.name).toBe("Base Mainnet");
      expect(result.config.chainId).toBe(8453);
    });

    test("resolves network by CAIP-2 format", () => {
      const result = resolveNetwork("eip155:8453");
      if (isValidationError(result)) {
        throw new Error(result.message);
      }
      expect(result.config.name).toBe("Base Mainnet");
      expect(result.caip2).toBe("eip155:8453");
    });

    test("normalizes network names (spaces, mainnet, sepolia)", () => {
      const result1 = resolveNetwork("Base Mainnet");
      const result2 = resolveNetwork("base-sepolia");
      const result3 = resolveNetwork("SKALE Base");

      if (isValidationError(result1) || isValidationError(result2) || isValidationError(result3)) {
        throw new Error("Network normalization failed");
      }

      expect(result1.config.chainId).toBe(8453);
      expect(result2.config.chainId).toBe(84532);
      expect(result3.config.chainId).toBe(1187947933);
    });

    test("errors for unknown network name", () => {
      const result = resolveNetwork("moonchain");
      expect(isValidationError(result)).toBe(true);
      if (isValidationError(result)) {
        expect(result.code).toBe("UNKNOWN_NETWORK");
        expect(result.message).toContain("Unknown network");
        expect(result.validOptions).toBeDefined();
      }
    });

    test("errors for unknown chain ID", () => {
      const result = resolveNetwork(999999);
      expect(isValidationError(result)).toBe(true);
      if (isValidationError(result)) {
        expect(result.code).toBe("UNKNOWN_NETWORK");
      }
    });

    test("errors for invalid CAIP-2 format", () => {
      const result = resolveNetwork("eip155:abc");
      expect(isValidationError(result)).toBe(true);
      if (isValidationError(result)) {
        expect(result.code).toBe("INVALID_CAIP_FORMAT");
      }
    });
  });

  describe("Token Resolution", () => {
    test("resolves token by symbol (case-insensitive)", () => {
      const baseNetwork = resolveNetwork("base");
      if (isValidationError(baseNetwork)) {
        throw new Error(baseNetwork.message);
      }

      const result = resolveToken("usdc", baseNetwork);
      if (isValidationError(result)) {
        throw new Error(result.message);
      }

      expect(result.config.symbol).toBe("USDC");
      expect(result.config.chainId).toBe(8453);
    });

    test("resolves token by EVM address", () => {
      const baseNetwork = resolveNetwork("base");
      if (isValidationError(baseNetwork)) {
        throw new Error(baseNetwork.message);
      }

      const usdcAddress = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
      const result = resolveToken(usdcAddress, baseNetwork);

      if (isValidationError(result)) {
        throw new Error(result.message);
      }

      expect(result.config.contractAddress.toLowerCase()).toBe(usdcAddress.toLowerCase());
    });

    test("resolves token by CAIP Asset ID", () => {
      const result = resolveToken("eip155:8453/erc20:0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913");

      if (isValidationError(result)) {
        throw new Error(result.message);
      }

      expect(result.config.chainId).toBe(8453);
      expect(result.caipAsset).toBe("eip155:8453/erc20:0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913");
    });

    test("resolves token by CustomToken object", () => {
      const customToken = {
        symbol: "CUSTOM",
        name: "Custom Token",
        version: "1",
        chainId: 8453,
        contractAddress: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as const,
        decimals: 6,
      };

      const result = resolveToken(customToken);

      if (isValidationError(result)) {
        throw new Error(result.message);
      }

      expect(result.config.symbol).toBe("CUSTOM");
    });

    test("errors when token on wrong network", () => {
      const ethereumNetwork = resolveNetwork("ethereum");
      if (isValidationError(ethereumNetwork)) {
        throw new Error(ethereumNetwork.message);
      }

      // Try to use Base USDC on Ethereum
      const baseUsdcToken = {
        symbol: "USDC",
        name: "USD Coin",
        version: "2",
        chainId: 8453, // Base
        contractAddress: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as const,
        decimals: 6,
      };

      const result = resolveToken(baseUsdcToken, ethereumNetwork);

      expect(isValidationError(result)).toBe(true);
      if (isValidationError(result)) {
        expect(result.code).toBe("TOKEN_NOT_ON_NETWORK");
        expect(result.message).toContain("chain 8453");
        expect(result.message).toContain("expected chain 1");
      }
    });

    test("handles unknown token symbols gracefully", () => {
      // Unknown symbols create a custom token with Base network (unfuckupable design)
      const result = resolveToken("unknown_token_xyz");

      if (isValidationError(result)) {
        throw new Error(result.message);
      }

      // Creates a custom token on Base network with the input symbol
      expect(result.config.symbol).toBe("UNKNOWN_TOKEN_XYZ");
      expect(result.config.chainId).toBe(8453); // Base
    });
  });

  describe("Facilitator Resolution", () => {
    test("resolves facilitator with declared networks/tokens", () => {
      const result = resolveFacilitator({
        url: "https://facilitator.example.com",
        networks: ["base", "ethereum"],
        tokens: ["usdc"],
      });

      if (isValidationError(result)) {
        throw new Error(result.message);
      }

      expect(result.url).toBe("https://facilitator.example.com");
      expect(result.networks.length).toBeGreaterThan(0);
      expect(result.tokens.length).toBeGreaterThan(0);
    });

    test("errors for invalid facilitator URL", () => {
      const result = resolveFacilitator({
        url: "not-a-url",
      });

      expect(isValidationError(result)).toBe(true);
      if (isValidationError(result)) {
        expect(result.code).toBe("VALIDATION_FAILED");
        expect(result.message).toContain("Invalid facilitator URL");
      }
    });
  });

  describe("Facilitator Support Checks", () => {
    test("checks network support correctly", () => {
      const facilitator = resolveFacilitator({
        url: "https://facilitator.example.com",
        networks: ["base"], // Only Base
      });

      if (isValidationError(facilitator)) {
        throw new Error(facilitator.message);
      }

      const ethereumNetwork = resolveNetwork("ethereum");
      if (isValidationError(ethereumNetwork)) {
        throw new Error(ethereumNetwork.message);
      }

      const baseNetwork = resolveNetwork("base");
      if (isValidationError(baseNetwork)) {
        throw new Error(baseNetwork.message);
      }

      const baseToken = resolveToken("usdc", baseNetwork);
      if (isValidationError(baseToken)) {
        throw new Error(baseToken.message);
      }

      // Should fail - facilitator doesn't support Ethereum
      const ethereumCheck = checkFacilitatorSupport(facilitator, ethereumNetwork, baseToken);
      expect(isValidationError(ethereumCheck)).toBe(true);
      if (isValidationError(ethereumCheck)) {
        expect(ethereumCheck.code).toBe("FACILITATOR_NO_NETWORK_SUPPORT");
        expect(ethereumCheck.message).toContain("does not support network");
        expect(ethereumCheck.validOptions).toContain("Base Mainnet");
      }

      // Should pass - facilitator supports Base
      const baseCheck = checkFacilitatorSupport(facilitator, baseNetwork, baseToken);
      if (isValidationError(baseCheck)) {
        throw new Error(baseCheck.message);
      }
      expect(baseCheck.supported).toBe(true);
    });

    test("checks token support correctly", () => {
      const facilitator = resolveFacilitator({
        url: "https://facilitator.example.com",
        networks: ["base"],
        tokens: ["usdc"], // Only USDC
      });

      if (isValidationError(facilitator)) {
        throw new Error(facilitator.message);
      }

      const baseNetwork = resolveNetwork("base");
      if (isValidationError(baseNetwork)) {
        throw new Error(baseNetwork.message);
      }

      // Create a fake EURC token on Base
      const eurcToken = resolveToken({
        symbol: "EURC",
        name: "EURC",
        version: "2",
        chainId: 8453,
        contractAddress: "0x60a3E35Cc302bFA44Cb288Bc5a4F316Fdb1adb42" as const,
        decimals: 6,
      });

      if (isValidationError(eurcToken)) {
        throw new Error(eurcToken.message);
      }

      // Should fail - facilitator doesn't support EURC
      const eurcCheck = checkFacilitatorSupport(facilitator, baseNetwork, eurcToken);
      expect(isValidationError(eurcCheck)).toBe(true);
      if (isValidationError(eurcCheck)) {
        expect(eurcCheck.code).toBe("FACILITATOR_NO_TOKEN_SUPPORT");
        expect(eurcCheck.message).toContain("does not support token");
        expect(eurcCheck.message).toContain("EURC");
      }
    });
  });

  describe("Complete Payment Config Validation", () => {
    test("validates correct configuration", () => {
      const result = validatePaymentConfig(
        "base",
        "usdc",
        {
          url: "https://facilitator.example.com",
          networks: ["base"],
          tokens: ["usdc"],
        },
        "0x1234567890123456789012345678901234567890",
        "1.0"
      );

      if (isValidationError(result)) {
        throw new Error(result.message);
      }

      expect(result.network.config.chainId).toBe(8453);
      expect(result.token.config.symbol).toBe("USDC");
      expect(result.facilitators.length).toBe(1);
    });

    test("errors when facilitator doesn't support network", () => {
      const result = validatePaymentConfig(
        "ethereum", // Facilitator only supports Base
        "usdc",
        {
          url: "https://facilitator.example.com",
          networks: ["base"], // Only Base
          tokens: ["usdc"],
        }
      );

      expect(isValidationError(result)).toBe(true);
      if (isValidationError(result)) {
        expect(result.code).toBe("FACILITATOR_NO_NETWORK_SUPPORT");
      }
    });

    test("errors when facilitator doesn't support token", () => {
      const result = validatePaymentConfig(
        "base",
        "eurc", // Facilitator only supports USDC
        {
          url: "https://facilitator.example.com",
          networks: ["base"],
          tokens: ["usdc"], // Only USDC
        }
      );

      expect(isValidationError(result)).toBe(true);
      if (isValidationError(result)) {
        expect(result.code).toBe("FACILITATOR_NO_TOKEN_SUPPORT");
      }
    });
  });

  describe("Multi-Accept Configuration", () => {
    test("validates multi-network, multi-token config", () => {
      const result = validateAcceptConfig(
        {
          networks: ["base", "ethereum"],
          tokens: ["usdc", "eurc"],
        },
        "0x1234567890123456789012345678901234567890",
        "1.0"
      );

      if (!result.success) {
        throw new Error(result.error.message);
      }

      expect(result.config.length).toBeGreaterThan(0);

      // Check that all combinations are valid
      for (const config of result.config) {
        expect(config.network.config).toBeDefined();
        expect(config.token.config).toBeDefined();
      }
    });

    test("accepts any valid EVM address (unfuckupable design)", () => {
      // Users can use any valid EVM address - the API is flexible
      const result = validateAcceptConfig(
        {
          networks: ["ethereum"],
          tokens: ["0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"], // USDC on Ethereum
        },
        "0x1234567890123456789012345678901234567890",
        "1.0"
      );

      if (!result.success) {
        throw new Error(result.error.message);
      }

      expect(result.config.length).toBeGreaterThan(0);

      // The API creates a custom token for any valid EVM address
      expect(result.config[0].token.config.contractAddress.toLowerCase()).toBe("0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48");
    });
  });

  describe("Utility Functions", () => {
    test("getAvailableNetworks returns all network names", () => {
      const networks = getAvailableNetworks();
      expect(Array.isArray(networks)).toBe(true);
      expect(networks.length).toBeGreaterThan(0);
      expect(networks).toContain("base");
      expect(networks).toContain("ethereum");
    });

    test("getAvailableTokens returns all token symbols", () => {
      const tokens = getAvailableTokens();
      expect(Array.isArray(tokens)).toBe(true);
      expect(tokens.length).toBeGreaterThan(0);
      expect(tokens).toContain("USDC");
    });
  });
});
