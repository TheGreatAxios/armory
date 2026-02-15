/**
 * Ethers Client - With Wallet Example
 */

import { createX402Client } from "@armory-sh/client-ethers";
import { ethers } from "ethers";
import { TOKENS } from "@armory-sh/tokens";

const API_URL = "https://api.example.com/protected-endpoint";
const CHAIN_ID = 8453;

async function main() {
  console.log("Ethers Client - With Wallet Example");
  console.log("===================================\n");

  let signer;

  if (typeof window !== "undefined" && window.ethereum) {
    console.log("Browser wallet detected (MetaMask, etc.)");

    const provider = new ethers.BrowserProvider(window.ethereum);
    console.log("\nRequesting account access...");
    await provider.send("eth_requestAccounts", []);

    signer = await provider.getSigner();
    console.log("Connected address:", await signer.getAddress());

    try {
      await provider.send("wallet_switchEthereumChain", [{
        chainId: `0x${CHAIN_ID.toString(16)}`,
      }]);
      console.log("Switched to Base network");
    } catch {
      console.log("Note: Please switch to Base network manually");
    }
  } else {
    console.log("No browser wallet detected, using private key");

    const PRIVATE_KEY = process.env.PRIVATE_KEY ?? "0x0000000000000000000000000000000000000000000000000000000000000001";
    const wallet = new ethers.Wallet(PRIVATE_KEY);
    console.log("Wallet address:", wallet.address);
    signer = wallet;
  }

  const client = createX402Client({
    signer,
    token: TOKENS.USDC_BASE,
    protocolVersion: "auto",
  });

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
