/**
 * Web3 Client - With Axios Example
 *
 * This example demonstrates using the web3 client with axios
 * for X-402 payments. Shows how axios interceptors handle
 * automatic payment retries.
 *
 * Run with:
 * ```bash
 * bun run examples/with-axios.ts
 * ```
 */

import { createX402Client, createX402Transport } from "@armory/client-web3";
import { Web3 } from "web3";
import axios, { type AxiosInstance } from "axios";
import { registerToken } from "@armory/core";

// Configuration
const PRIVATE_KEY = process.env.PRIVATE_KEY ?? "0x0000000000000000000000000000000000000000000000000000000000000001";
const API_BASE_URL = "https://api.example.com";

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
  console.log("Web3 Client - With Axios Example");
  console.log("================================\n");

  // Create Web3 instance
  const web3 = new Web3();

  // Create account from private key
  const account = web3.eth.accounts.privateKeyToAccount(PRIVATE_KEY);
  console.log("Account address:", account.address);

  // Create X-402 client with token object (recommended approach)
  const client = createX402Client({
    account,
    network: "base",
    token: USDC_BASE, // Pre-configured token object
    version: 2,
  });

  // Alternatively, use individual fields (legacy approach):
  // const client = createX402Client({
  //   account,
  //   network: "base",
  //   domainName: "USD Coin",
  //   domainVersion: "2",
  //   version: 2,
  // });

  // Create transport with automatic payment handling
  const transport = createX402Transport({ client });

  // Create axios instance with X-402 fetch interceptor
  const axiosInstance: AxiosInstance = axios.create({
    baseURL: API_BASE_URL,
  });

  // Override the default adapter to use our transport
  axiosInstance.defaults.adapter = async (config) => {
    const url = `${config.baseURL ?? ""}${config.url ?? ""}`;
    const response = await transport.fetch(url, {
      method: config.method?.toUpperCase() ?? "GET",
      headers: config.headers as HeadersInit,
      body: config.data ? JSON.stringify(config.data) : undefined,
    });

    return {
      data: await response.json(),
      status: response.status,
      statusText: response.statusText,
      headers: response.headers as unknown as Record<string, string>,
      config,
    };
  };

  console.log("\nMaking GET request to:", API_BASE_URL);

  try {
    // Make request - payment is handled automatically
    const response = await axiosInstance.get("/protected-endpoint");

    console.log("\nResponse status:", response.status);
    console.log("\nResponse data:", response.data);
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error("\nAxios error:", error.message);
      if (error.response) {
        console.error("Response status:", error.response.status);
        console.error("Response data:", error.response.data);
      }
    } else {
      console.error("\nError:", error instanceof Error ? error.message : error);
    }
  }
}

// Run example
main().catch(console.error);
