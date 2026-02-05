/**
 * Ethers Client - With Wallet Example
 *
 * This example demonstrates using the ethers client with a real wallet
 * (e.g., MetaMask, WalletConnect) for X-402 payments. Shows how to
 * connect to a browser wallet and handle user interactions.
 *
 * NOTE: This example requires a browser environment with window.ethereum
 * Run with a bundler (e.g., vite, webpack) or in a browser console.
 *
 * Run with:
 * ```bash
 * # Build with vite or similar
 * bun run examples/with-wallet.ts
 * ```
 */

import { createX402Client } from "@armory/client-ethers";
import { ethers } from "ethers";
import { registerToken } from "@armory/base";

// Configuration
const API_URL = "https://api.example.com/protected-endpoint";
const CHAIN_ID = 8453; // Base mainnet

// Register a custom token (recommended approach)
const USDC_BASE = registerToken({
  symbol: "USDC",
  name: "USD Coin",
  version: "2",
  contractAddress: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  chainId: 8453,
  decimals: 6,
});

async function main() {
  console.log("Ethers Client - With Wallet Example");
  console.log("===================================\n");

  let provider;
  let signer;

  // Check if running in browser with wallet
  if (typeof window !== "undefined" && window.ethereum) {
    console.log("Browser wallet detected (MetaMask, etc.)");

    // Create provider from browser wallet
    provider = new ethers.BrowserProvider(window.ethereum);

    // Request account access
    console.log("\nRequesting account access...");
    await provider.send("eth_requestAccounts", []);

    // Get signer
    signer = await provider.getSigner();
    console.log("Connected address:", await signer.getAddress());

    // Switch to Base network
    try {
      await provider.send("wallet_switchEthereumChain", [{
        chainId: `0x${CHAIN_ID.toString(16)}`,
      }]);
      console.log("Switched to Base network");
    } catch (switchError) {
      console.log("Note: Please switch to Base network manually");
    }
  } else {
    // Fallback: Use private key for Node.js environment
    console.log("No browser wallet detected, using private key");

    const PRIVATE_KEY = process.env.PRIVATE_KEY ?? "0x0000000000000000000000000000000000000000000000000000000000000001";
    const wallet = new ethers.Wallet(PRIVATE_KEY);
    console.log("Wallet address:", wallet.address);
    signer = wallet;
  }

  // Create X-402 client with token object (recommended approach)
  const client = createX402Client({
    signer,
    token: USDC_BASE, // Pre-configured token object
    protocolVersion: "auto",
  });

  // Alternatively, use individual fields (legacy approach):
  // const client = createX402Client({
  //   signer,
  //   domainName: "USD Coin",
  //   domainVersion: "2",
  //   protocolVersion: "auto",
  // });

  console.log("\nMaking request to:", API_URL);

  try {
    // Make request - payment is handled automatically
    // If using browser wallet, user will be prompted to sign
    const response = await client.fetch(API_URL, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    console.log("\nResponse status:", response.status);

    if (response.ok) {
      const data = await response.json();
      console.log("\nResponse data:", data);
    } else {
      console.error("\nRequest failed:", response.statusText);
      const error = await response.text();
      console.error("Error details:", error);
    }
  } catch (error) {
    console.error("\nError:", error instanceof Error ? error.message : error);
  }
}

// Run example
main().catch(console.error);

// Type declaration for window.ethereum
declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
      send: (method: string, params?: unknown[]) => Promise<unknown>;
      on: (event: string, handler: (...args: unknown[]) => void) => void;
      removeListener: (event: string, handler: (...args: unknown[]) => void) => void;
      isMetaMask?: boolean;
    };
  }
}
