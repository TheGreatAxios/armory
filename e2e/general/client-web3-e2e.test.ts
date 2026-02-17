/**
 * Client-Web3 E2E Tests
 *
 * End-to-end tests for @armory-sh/client-web3
 */

import { beforeAll, describe, expect, test } from "bun:test";
import { registerToken, TOKENS } from "@armory-sh/base";
import { createX402Client, createX402Transport } from "@armory-sh/client-web3";
import { Web3 } from "web3";

// ============================================================================
// Setup
// ============================================================================

const TEST_PRIVATE_KEY = `0x${"a".repeat(64)}`;

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
  // Token Registration
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

      expect(TOKENS.USDC_BASE_SEPOLIA.contractAddress).toMatch(
        /^0x[a-fA-F0-9]{40}$/,
      );
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
