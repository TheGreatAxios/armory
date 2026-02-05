/**
 * Web3 Client - With Wallet Example
 *
 * This example demonstrates using the web3 client with a real wallet
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

import { createX402Client, createX402Transport } from "@armory/client-web3";
import { Web3 } from "web3";
import { registerToken } from "@armory/base";

// Configuration
const API_URL = "https://api.example.com/protected-endpoint";

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
  console.log("Web3 Client - With Wallet Example");
  console.log("==================================\n");

  let client;

  // Check if running in browser with wallet
  if (typeof window !== "undefined" && window.ethereum) {
    console.log("Browser wallet detected (MetaMask, etc.)");

    // Create Web3 instance with browser provider
    const web3 = new Web3(window.ethereum);

    // Request account access
    console.log("\nRequesting account access...");
    const accounts = await web3.eth.requestAccounts();
    console.log("Connected address:", accounts[0]);

    // Get account
    const account = {
      address: accounts[0],
      privateKey: "", // Not available in browser wallet
      signTransaction: async (tx: unknown) => {
        return await window.ethereum!.request({
          method: "eth_signTransaction",
          params: [tx],
        });
      },
      signTypedData: async (typedData: unknown) => {
        return await window.ethereum!.request({
          method: "eth_signTypedData_v4",
          params: [accounts[0], typedData],
        });
      },
    };

    // Create X-402 client with token object (recommended approach)
    client = createX402Client({
      account: account as any,
      network: "base",
      token: USDC_BASE, // Pre-configured token object
      version: 2,
    });

    // Alternatively, use individual fields (legacy approach):
    // client = createX402Client({
    //   account: account as any,
    //   network: "base",
    //   domainName: "USD Coin",
    //   domainVersion: "2",
    //   version: 2,
    // });
  } else {
    // Fallback: Use private key for Node.js environment
    console.log("No browser wallet detected, using private key");

    const PRIVATE_KEY = process.env.PRIVATE_KEY ?? "0x0000000000000000000000000000000000000000000000000000000000000001";
    const web3 = new Web3();
    const account = web3.eth.accounts.privateKeyToAccount(PRIVATE_KEY);
    console.log("Account address:", account.address);

    // Create X-402 client with token object (recommended approach)
    client = createX402Client({
      account,
      network: "base",
      token: USDC_BASE, // Pre-configured token object
      version: 2,
    });

    // Alternatively, use individual fields (legacy approach):
    // client = createX402Client({
    //   account,
    //   network: "base",
    //   domainName: "USD Coin",
    //   domainVersion: "2",
    //   version: 2,
    // });
  }

  // Create transport with automatic payment handling
  const transport = createX402Transport({ client });

  console.log("\nMaking request to:", API_URL);

  try {
    // Make request - payment is handled automatically
    // If using browser wallet, user will be prompted to sign
    const response = await transport.fetch(API_URL, {
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
      on: (event: string, handler: (...args: unknown[]) => void) => void;
      removeListener: (event: string, handler: (...args: unknown[]) => void) => void;
      isMetaMask?: boolean;
    };
  }
}
