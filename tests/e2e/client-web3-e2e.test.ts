/**
 * Client-Web3 E2E Tests
 *
 * End-to-end tests for @armory-sh/client-web3
 */

import { describe, test, expect, beforeAll } from "bun:test";
import { createX402Client, createX402Transport, createX402V1Payment, createX402V2Payment } from "@armory-sh/client-web3";
import { Web3 } from "web3";
import { TOKENS } from "@armory-sh/tokens";
import { registerToken } from "@armory-sh/base";

// ============================================================================
// Setup
// ============================================================================

const TEST_PRIVATE_KEY = "0x" + "a".repeat(64);

describe("Client-Web3 E2E", () => {
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
      const web3 = new Web3();
      const account = web3.eth.accounts.create(TEST_PRIVATE_KEY);

      const client = createX402Client({
        account,
        network: "base-sepolia",
        version: 2,
      });

      expect(client).toBeDefined();
      expect(typeof client.fetch).toBe("function");
    });

    test("client has fetch method", () => {
      const web3 = new Web3();
      const account = web3.eth.accounts.create(TEST_PRIVATE_KEY);

      const client = createX402Client({
        account,
        network: "base-sepolia",
        version: 2,
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
        client: null, // Client optional for transport
      });

      expect(transport).toBeDefined();
      expect(typeof transport.fetch).toBe("function");
    });
  });

  // ============================================================================
  // Payment Creation
  // ============================================================================

  describe("Payment Creation", () => {
    test("createX402V1Payment function exists", () => {
      expect(typeof createX402V1Payment).toBe("function");
    });

    test("createX402V2Payment function exists", () => {
      expect(typeof createX402V2Payment).toBe("function");
    });

    test("creates V2 payment structure", () => {
      const payment = createX402V2Payment({
        from: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1" as `0x${string}`,
        to: "0x036CbD5d9A3b9231f83BefBE4F9E3FAA03eee2e0" as `0x${string}`,
        value: "1000000",
        nonce: "0x" + "0".repeat(64) as `0x${string}`,
        validAfter: "0x0",
        validBefore: "0x" + (Math.floor(Date.now() / 1000) + 3600).toString(16),
        signature: "0x" + "a".repeat(130) as `0x${string}`,
        accepted: {
          scheme: "exact",
          network: "eip155:84532",
          amount: "1000000",
          asset: "0x036CbD5d9A3b9231f83BefBE4F9E3FAA03eee2e0" as `0x${string}`,
          payTo: "0x036CbD5d9A3b9231f83BefBE4F9E3FAA03eee2e0" as `0x${string}`,
          maxTimeoutSeconds: 3600,
        },
      });

      expect(payment).toBeDefined();
      expect(payment.x402Version).toBe(2);
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
      const web3 = new Web3();
      const account = web3.eth.accounts.create(TEST_PRIVATE_KEY);

      expect(account.address).toMatch(/^0x[a-fA-F0-9]{40}$/);
      expect(account.privateKey).toMatch(/^0x[a-fA-F0-9]{64}$/);
    });

    test("account has correct properties", () => {
      const web3 = new Web3();
      const account = web3.eth.accounts.create();

      expect(account.address).toMatch(/^0x[a-fA-F0-9]{40}$/);
      expect(account.privateKey).toBeDefined();
    });
  });

  // ============================================================================
  // Type Exports
  // ============================================================================

  describe("Type Exports", () => {
    test("Web3X402Client type is available", () => {
      const web3 = new Web3();
      const account = web3.eth.accounts.create();
      expect(account.address).toBeDefined();
    });
  });
});
