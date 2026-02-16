/**
 * Client-Ethers E2E Tests
 *
 * End-to-end tests for @armory-sh/client-ethers
 */

import { describe, test, expect, beforeAll } from "bun:test";
import { Wallet } from "ethers";
import { createX402Client, createX402Transport } from "@armory-sh/client-ethers";
import { TOKENS, registerToken } from "@armory-sh/base";

// ============================================================================
// Setup
// ============================================================================

const TEST_PRIVATE_KEY = "0x" + "a".repeat(64);

describe("Client-Ethers E2E", () => {
  beforeAll(async () => {
    // Register test tokens
    registerToken(TOKENS.USDC_BASE);
    registerToken(TOKENS.USDC_BASE_SEPOLIA);
  });

  // ============================================================================
  // X402 Client Factory
  // ============================================================================

  describe("X402 Client Factory", () => {
    test("creates client with signer", () => {
      const wallet = new Wallet(TEST_PRIVATE_KEY);
      const client = createX402Client({
        signer: wallet,
      });

      expect(client).toBeDefined();
      expect(typeof client.get).toBe("function");
      expect(typeof client.post).toBe("function");
      expect(typeof client.put).toBe("function");
      expect(typeof client.del).toBe("function");
      expect(typeof client.patch).toBe("function");
    });

    test("client has setSigner method", () => {
      const wallet = new Wallet(TEST_PRIVATE_KEY);
      const client = createX402Client({
        signer: wallet,
      });

      expect(typeof client.setSigner).toBe("function");
      expect(typeof client.getSigner).toBe("function");
    });
  });

  // ============================================================================
  // X402 Transport
  // ============================================================================

  describe("X402 Transport", () => {
    test("creates transport with config", () => {
      const transport = createX402Transport({
        baseURL: "https://api.example.com",
      });

      expect(transport).toBeDefined();
      expect(typeof transport.get).toBe("function");
      expect(typeof transport.setSigner).toBe("function");
    });

    test("transport can be configured", () => {
      const wallet = new Wallet(TEST_PRIVATE_KEY);
      const transport = createX402Transport();

      transport.setSigner(wallet);

      expect(transport).toBeDefined();
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
  // Wallet Creation
  // ============================================================================

  describe("Wallet Creation", () => {
    test("creates wallet from private key", () => {
      const wallet = new Wallet(TEST_PRIVATE_KEY);

      expect(wallet.address).toMatch(/^0x[a-fA-F0-9]{40}$/);
    });

    test("creates random wallet", () => {
      const randomWallet = Wallet.createRandom();

      expect(randomWallet.address).toMatch(/^0x[a-fA-F0-9]{40}$/);
      expect(randomWallet.privateKey).toMatch(/^0x[a-fA-F0-9]{64}$/);
    });
  });

  // ============================================================================
  // Type Exports
  // ============================================================================

  describe("Type Exports", () => {
    test("Signer type is available", () => {
      const wallet = new Wallet(TEST_PRIVATE_KEY);
      expect(wallet).toBeDefined();
    });
  });
});
