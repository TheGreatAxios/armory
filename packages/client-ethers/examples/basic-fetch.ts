/**
 * Ethers Client - Basic Fetch Example
 *
 * This example demonstrates using the ethers client with native fetch
 * for X-402 payments. Shows automatic payment handling when a 402
 * Payment Required response is received.
 *
 * Run with:
 * ```bash
 * bun run examples/basic-fetch.ts
 * ```
 */

import { createX402Client } from "@armory-sh/client-ethers";
import { ethers } from "ethers";
import { registerToken } from "@armory-sh/base";

// Configuration
const PRIVATE_KEY = process.env.PRIVATE_KEY ?? "0x0000000000000000000000000000000000000000000000000000000000000001";
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
  console.log("Ethers Client - Basic Fetch Example");
  console.log("===================================\n");

  // Create signer from private key
  const wallet = new ethers.Wallet(PRIVATE_KEY);
  console.log("Wallet address:", wallet.address);

  // Create X-402 client with token object (recommended approach)
  const client = createX402Client({
    signer: wallet,
    token: USDC_BASE, // Pre-configured token object
    protocolVersion: "auto", // Auto-detect v1 or v2
  });

  // Alternatively, use individual fields (legacy approach):
  // const client = createX402Client({
  //   signer: wallet,
  //   domainName: "USD Coin",
  //   domainVersion: "2",
  //   protocolVersion: "auto",
  // });

  console.log("\nMaking request to:", API_URL);

  try {
    // Make request - payment is handled automatically
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
