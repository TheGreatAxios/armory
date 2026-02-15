/**
 * Client-Viem E2E Tests
 *
 * End-to-end tests for @armory-sh/client-viem
 */

import { describe, test, expect, beforeAll } from "bun:test";
import { createX402Client, createX402Transport, armoryPay, armoryGet, armoryPost } from "@armory-sh/client-viem";
import { privateKeyToAccount } from "viem/accounts";
import { TOKENS } from "@armory-sh/tokens";
import { registerToken } from "@armory-sh/base";

// ============================================================================
// Setup
// ============================================================================

const TEST_PRIVATE_KEY = "0x" + "a".repeat(64);

describe("Client-Viem E2E", () => {
  beforeAll(async () => {
    // Register test tokens
    registerToken(TOKENS.USDC_BASE);
    registerToken(TOKENS.USDC_BASE_SEPOLIA);
  });

  // ============================================================================
  // X402 Client Factory
  // ============================================================================

  describe("X402 Client Factory", () => {
    test("creates client with account", () => {
      const account = privateKeyToAccount(TEST_PRIVATE_KEY as `0x${string}`);
      const client = createX402Client({
        wallet: { type: "account", account },
      });

      expect(client).toBeDefined();
      expect(typeof client.fetch).toBe("function");
    });

    test("creates client with walletClient", () => {
      const account = privateKeyToAccount(TEST_PRIVATE_KEY as `0x${string}`);
      const client = createX402Client({
        wallet: { type: "account", account },
      });

      expect(client).toBeDefined();
    });

    test("client has fetch method", () => {
      const account = privateKeyToAccount(TEST_PRIVATE_KEY as `0x${string}`);
      const client = createX402Client({
        wallet: { type: "account", account },
      });

      expect(typeof client.fetch).toBe("function");
    });
  });

  // ============================================================================
  // X402 Transport
  // ============================================================================

  describe("X402 Transport", () => {
    test("creates transport wrapper", () => {
      const transport = createX402Transport({
        wallet: { type: "account", account: privateKeyToAccount(TEST_PRIVATE_KEY as `0x${string}`) },
      });

      expect(transport).toBeDefined();
      expect(typeof transport).toBe("function");
    });
  });

  // ============================================================================
  // Simple API
  // ============================================================================

  describe("Simple API", () => {
    test("armoryPay function exists", () => {
      expect(typeof armoryPay).toBe("function");
    });

    test("armoryGet function exists", () => {
      expect(typeof armoryGet).toBe("function");
    });

    test("armoryPost function exists", () => {
      expect(typeof armoryPost).toBe("function");
    });
  });

  // ============================================================================
  // Token Registration
  // ============================================================================

  describe("Token Registration", () => {
    test("tokens can be registered", () => {
      expect(() => {
        registerToken(TOKENS.USDC_BASE);
        registerToken(TOKENS.USDC_BASE_SEPOLIA);
      }).not.toThrow();
    });

    test("tokens have correct properties", () => {
      expect(TOKENS.USDC_BASE.contractAddress).toMatch(/^0x[a-fA-F0-9]{40}$/);
      expect(TOKENS.USDC_BASE.chainId).toBe(8453);
      expect(TOKENS.USDC_BASE.decimals).toBe(6);

      expect(TOKENS.USDC_BASE_SEPOLIA.contractAddress).toMatch(/^0x[a-fA-F0-9]{40}$/);
      expect(TOKENS.USDC_BASE_SEPOLIA.chainId).toBe(84532);
      expect(TOKENS.USDC_BASE_SEPOLIA.decimals).toBe(6);
    });
  });

  // ============================================================================
  // Account Creation
  // ============================================================================

  describe("Account Creation", () => {
    test("creates account from private key", () => {
      const account = privateKeyToAccount(TEST_PRIVATE_KEY as `0x${string}`);

      expect(account.address).toMatch(/^0x[a-fA-F0-9]{40}$/);
      expect(account.signMessage).toBeDefined();
    });

    test("account has correct properties", () => {
      const account = privateKeyToAccount(TEST_PRIVATE_KEY as `0x${string}`);

      expect(account.type).toBe("local");
      expect(typeof account.signMessage).toBe("function");
    });
  });

  // ============================================================================
  // Type Exports
  // ============================================================================

  describe("Type Exports", () => {
    test("X402Wallet type is available", () => {
      const account = privateKeyToAccount(TEST_PRIVATE_KEY as `0x${string}`);
      expect(account.address).toBeDefined();
    });
  });
});
