import { createX402Client } from "@armory-sh/client-viem";
import { privateKeyToAccount } from "viem/accounts";
import { registerToken } from "@armory-sh/base";

const PRIVATE_KEY = process.env.PRIVATE_KEY ?? "0x0000000000000000000000000000000000000000000000000000000000000001";
const API_URL = "https://api.example.com/protected-endpoint";

// Register a custom token (or use pre-configured tokens from @armory-sh/tokens)
const USDC_BASE = registerToken({
  symbol: "USDC",
  name: "USD Coin",
  version: "2",
  contractAddress: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  chainId: 8453,
  decimals: 6,
});

async function main() {
  console.log("Viem Client - Basic Fetch Example");
  console.log("==================================\n");

  const account = privateKeyToAccount(PRIVATE_KEY);
  console.log("Account address:", account.address);

  // Create client with token object (recommended approach)
  const client = createX402Client({
    wallet: { type: "account", account },
    token: USDC_BASE, // Pre-configured token object
    version: 2,
  });

  // Alternatively, you can use individual fields (legacy approach):
  // const client = createX402Client({
  //   wallet: { type: "account", account },
  //   domainName: "USD Coin",
  //   domainVersion: "2",
  //   version: 2,
  // });

  console.log("\nMaking request to:", API_URL);

  try {
    const response = await client.fetch(API_URL, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
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

main().catch(console.error);
