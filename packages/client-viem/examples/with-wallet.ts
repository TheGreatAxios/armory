import { TOKENS } from "@armory-sh/base";
import { createX402Client } from "@armory-sh/client-viem";
import { createWalletClient, custom } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { base } from "viem/chains";

const API_URL = "https://api.example.com/protected-endpoint";

async function main() {
  console.log("Viem Client - With Wallet Example");
  console.log("==================================\n");

  let client;

  if (typeof window !== "undefined" && window.ethereum) {
    console.log("Browser wallet detected (MetaMask, etc.)");

    const walletClient = createWalletClient({
      chain: base,
      transport: custom(window.ethereum!),
    });

    const [address] = await walletClient.getAddresses();
    console.log("Connected address:", address);

    client = createX402Client({
      wallet: { type: "walletClient", walletClient },
      token: TOKENS.USDC_BASE,
      version: 2,
    });
  } else {
    console.log("No browser wallet detected, using private key");

    const PRIVATE_KEY =
      process.env.PRIVATE_KEY ??
      "0x0000000000000000000000000000000000000000000000000000000000000001";
    const account = privateKeyToAccount(PRIVATE_KEY);
    console.log("Account address:", account.address);

    client = createX402Client({
      wallet: { type: "account", account },
      token: TOKENS.USDC_BASE,
      version: 2,
    });
  }

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

declare global {
  interface Window {
    ethereum?: {
      request: (args: {
        method: string;
        params?: unknown[];
      }) => Promise<unknown>;
      on: (event: string, handler: (...args: unknown[]) => void) => void;
      removeListener: (
        event: string,
        handler: (...args: unknown[]) => void,
      ) => void;
    };
  }
}
