/**
 * Ethers Client - Basic Fetch Example
 */

import { TOKENS } from "@armory-sh/base";
import { createX402Client } from "@armory-sh/client-ethers";
import { ethers } from "ethers";

const PRIVATE_KEY =
  process.env.PRIVATE_KEY ??
  "0x0000000000000000000000000000000000000000000000000000000000000001";
const API_URL = "https://api.example.com/protected-endpoint";

async function main() {
  console.log("Ethers Client - Basic Fetch Example");
  console.log("===================================\n");

  const wallet = new ethers.Wallet(PRIVATE_KEY);
  console.log("Wallet address:", wallet.address);

  const client = createX402Client({
    signer: wallet,
    token: TOKENS.USDC_BASE,
    protocolVersion: "auto",
  });

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
