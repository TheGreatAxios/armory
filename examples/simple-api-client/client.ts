/**
 * Simple One-Line API Example - Viem Client
 *
 * This demonstrates the NEW simplified Armory client API with:
 * - 1-line payment function
 * - Network/token resolution by name, chain ID, or CAIP
 * - Automatic error handling
 */

import { armoryGet, armoryPay, armoryPost } from "@armory/client-viem";
import { privateKeyToAccount } from "viem/accounts";

// ============================================================================
// Setup
// ============================================================================

// Create a wallet (in production, use a proper wallet provider)
const privateKey = process.env.PRIVATE_KEY ?? "0x...";
const account = privateKeyToAccount(privateKey);

const wallet = {
  account,
};

// ============================================================================
// Examples
// ============================================================================

/**
 * Example 1: Basic payment - all default formats
 */
async function basicPayment() {
  const result = await armoryPay(
    wallet,
    "https://api.example.com/data",
    "base", // Network name
    "usdc", // Token symbol
  );

  if (result.success) {
    console.log("Payment successful!");
    console.log("Data:", result.data);
    console.log("Tx Hash:", result.txHash);
  } else {
    console.error("Payment failed:", result.code, result.message);
  }
}

/**
 * Example 2: Using different network formats
 */
async function differentNetworkFormats() {
  const url = "https://api.example.com/data";

  // All of these are equivalent:
  await armoryPay(wallet, url, "base", "usdc"); // name
  await armoryPay(wallet, url, 8453, "usdc"); // chain ID
  await armoryPay(wallet, url, "eip155:8453", "usdc"); // CAIP-2
}

/**
 * Example 3: Using different token formats
 */
async function differentTokenFormats() {
  const url = "https://api.example.com/data";

  // All of these are equivalent:
  await armoryPay(wallet, url, "base", "usdc"); // symbol
  await armoryPay(wallet, url, "base", "USDC"); // case-insensitive
  await armoryPay(
    wallet,
    url,
    "base",
    "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  ); // address
  await armoryPay(
    wallet,
    url,
    "base",
    "eip155:8453/erc20:0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  ); // CAIP Asset ID
}

/**
 * Example 4: POST request with body
 */
async function postRequest() {
  const result = await armoryPost(
    wallet,
    "https://api.example.com/purchase",
    "base",
    "usdc",
    { itemId: "premium_plan" }, // Request body
  );

  if (result.success) {
    console.log("Purchase successful:", result.data);
  }
}

/**
 * Example 5: GET request helper
 */
async function getRequest() {
  const result = await armoryGet(
    wallet,
    "https://api.example.com/user/profile",
    "base",
    "usdc",
  );

  if (result.success) {
    console.log("User profile:", result.data);
  }
}

/**
 * Example 6: With options
 */
async function withOptions() {
  const result = await armoryPay(
    wallet,
    "https://api.example.com/data",
    "base",
    "usdc",
    {
      method: "POST",
      body: { custom: "data" },
      headers: { "X-Custom-Header": "value" },
      version: 2, // Force v2 protocol
      debug: true, // Enable debug logging
    },
  );

  if (result.success) {
    console.log("Data:", result.data);
  }
}

/**
 * Example 7: Error handling
 */
async function errorHandling() {
  // Try to use a token on the wrong network
  const result = await armoryPay(
    wallet,
    "https://api.example.com/data",
    "ethereum", // Wrong network for this USDC
    "usdc",
  );

  if (!result.success) {
    switch (result.code) {
      case "TOKEN_NOT_ON_NETWORK":
        console.error("Token not available on this network");
        break;
      case "UNKNOWN_NETWORK":
        console.error("Network not supported");
        break;
      case "UNKNOWN_TOKEN":
        console.error("Token not found");
        break;
      default:
        console.error("Payment failed:", result.message);
    }
  }
}

/**
 * Example 8: Utility functions
 */
async function utilityFunctions() {
  // Validate a network without making a request
  const { validateNetwork, validateToken, getNetworks, getTokens } =
    await import("@armory/client-viem");

  // Check if a network is supported
  const networkCheck = validateNetwork("base");
  if (networkCheck.success) {
    console.log("Network supported:", networkCheck.network);
  }

  // Check if a token is supported
  const tokenCheck = validateToken("usdc", "base");
  if (tokenCheck.success) {
    console.log("Token supported:", tokenCheck.token, "on", tokenCheck.network);
  }

  // Get all available networks
  const networks = getNetworks();
  console.log("Available networks:", networks);

  // Get all available tokens
  const tokens = getTokens();
  console.log("Available tokens:", tokens);
}

// ============================================================================
// Run Examples
// ============================================================================

async function main() {
  console.log("Armory Simple API Examples\n");

  console.log("Example 1: Basic payment");
  await basicPayment();

  console.log("\nExample 4: POST request");
  await postRequest();

  console.log("\nExample 7: Error handling");
  await errorHandling();
}

// Run if executed directly
if (import.meta.main) {
  main().catch(console.error);
}

export {
  basicPayment,
  differentNetworkFormats,
  differentTokenFormats,
  postRequest,
  getRequest,
  withOptions,
  errorHandling,
  utilityFunctions,
};
