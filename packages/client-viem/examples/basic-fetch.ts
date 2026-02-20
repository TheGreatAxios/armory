import { TOKENS } from "@armory-sh/base";
import { createX402Client } from "@armory-sh/client-viem";
import { privateKeyToAccount } from "viem/accounts";

const PRIVATE_KEY =
  process.env.PRIVATE_KEY ??
  "0x0000000000000000000000000000000000000000000000000000000000000001";
const API_URL = "https://api.example.com/protected-endpoint";

async function main() {
  console.log("Viem Client - Basic Fetch Example");
  console.log("==================================\n");

  const account = privateKeyToAccount(PRIVATE_KEY);
  console.log("Account address:", account.address);

  const client = createX402Client({
    wallet: { type: "account", account },
    token: TOKENS.USDC_BASE,
    version: 2,
  });

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
