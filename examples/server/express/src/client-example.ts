/**
 * Client Example for X-402 Express Server
 *
 * Demonstrates how to:
 * - Make requests to protected endpoints
 * - Handle 402 Payment Required responses
 * - Create and send payments using EIP-3009
 */

import {
  createTransferWithAuthorization,
  type PaymentPayloadV2,
} from "@armory/base";
import { privateKeyToAccount } from "viem/accounts";
import { toBytes } from "viem";

// ============================================================================
// Configuration
// ============================================================================

const SERVER_URL = "http://localhost:3000";

// Example private key (NEVER use in production - use proper wallet management)
const PRIVATE_KEY = process.env.PRIVATE_KEY || "0x...";

// ============================================================================
// Wallet Setup
// ============================================================================

const account = privateKeyToAccount(PRIVATE_KEY as `0x${string}`);

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Create a payment signature for the given requirements
 * Uses EIP-3009 transferWithAuthorization
 */
async function createPaymentSignature(requirements: {
  amount: string;
  to: string;
  chainId: string;
  assetId: string;
  nonce: string;
  expiry: number;
}): Promise<PaymentPayloadV2> {
  // Create EIP-712 typed data for EIP-3009
  const authorization = createTransferWithAuthorization({
    from: account.address,
    to: requirements.to as `0x${string}`,
    value: BigInt(requirements.amount),
    validAfter: 0,
    validBefore: BigInt(requirements.expiry),
    nonce: requirements.nonce,
  });

  // Sign the authorization
  const signature = await account.signTypedData({
    domain: {
      name: "USD Coin",
      version: "2",
      chainId: parseInt(requirements.chainId.split(":")[1]),
      verifyingContract: requirements.assetId.split(":")[2] as `0x${string}`,
    },
    types: {
      TransferWithAuthorization: [
        { name: "from", type: "address" },
        { name: "to", type: "address" },
        { name: "value", type: "uint256" },
        { name: "validAfter", type: "uint256" },
        { name: "validBefore", type: "uint256" },
        { name: "nonce", type: "bytes32" },
      ],
    },
    primaryType: "TransferWithAuthorization",
    message: authorization,
  });

  // Parse signature into v, r, s components
  const sigBytes = toBytes(signature);
  const r = `0x${Buffer.from(sigBytes.slice(0, 32)).toString("hex")}`;
  const s = `0x${Buffer.from(sigBytes.slice(32, 64)).toString("hex")}`;
  const v = sigBytes[64];

  return {
    from: account.address,
    to: requirements.to,
    amount: requirements.amount,
    nonce: requirements.nonce,
    expiry: requirements.expiry,
    signature: { v, r, s },
    chainId: requirements.chainId as `eip155:${string}`,
    assetId: requirements.assetId as `eip155:${string}/erc20:${string}`,
  };
}

/**
 * Make a request to a protected endpoint
 * Handles 402 responses and creates payment automatically
 */
async function makeRequest(endpoint: string, options: RequestInit = {}) {
  const url = `${SERVER_URL}${endpoint}`;

  // First, try the request without payment
  let response = await fetch(url, options);

  // If we get 402, create a payment and retry
  if (response.status === 402) {
    const data = await response.json();

    if (data.requirements) {
      console.log("Payment required");
      console.log("  Amount:", data.requirements.amount);
      console.log("  To:", data.requirements.to);
      console.log("  Chain:", data.requirements.chainId);

      // Create payment signature
      const payment = await createPaymentSignature(data.requirements);

      console.log("Payment created from:", payment.from);

      // Retry request with payment header
      response = await fetch(url, {
        ...options,
        headers: {
          ...options.headers,
          "PAYMENT-SIGNATURE": JSON.stringify(payment),
        },
      });
    }
  }

  return response;
}

// ============================================================================
// Examples
// ============================================================================

/**
 * Example 1: Access public endpoint (no payment needed)
 */
async function examplePublicEndpoint() {
  console.log("\n=== Example 1: Public Endpoint ===");

  const response = await fetch(`${SERVER_URL}/api/info`);
  const data = await response.json();

  console.log("Response:", JSON.stringify(data, null, 2));
}

/**
 * Example 2: Access protected endpoint with automatic payment
 */
async function exampleProtectedEndpoint() {
  console.log("\n=== Example 2: Protected Endpoint ===");

  const response = await makeRequest("/api/protected");
  const data = await response.json();

  console.log("Response:", JSON.stringify(data, null, 2));
}

/**
 * Example 3: POST request with payment
 */
async function examplePostRequest() {
  console.log("\n=== Example 3: POST Request ===");

  const response = await makeRequest("/api/actions/generate", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      prompt: "Generate something cool",
    }),
  });

  const data = await response.json();
  console.log("Response:", JSON.stringify(data, null, 2));
}

/**
 * Example 4: Get payment requirements upfront
 */
async function exampleGetRequirements() {
  console.log("\n=== Example 4: Get Payment Requirements ===");

  const response = await fetch(`${SERVER_URL}/api/payment-requirements`);
  const data = await response.json();

  console.log("Payment Requirements:", JSON.stringify(data, null, 2));

  // Create payment preemptively
  if (data.requirements) {
    const payment = await createPaymentSignature(data.requirements);

    console.log("Pre-created payment from:", payment.from);

    // Now make the request with payment already included
    const protectedResponse = await fetch(`${SERVER_URL}/api/protected`, {
      headers: {
        "PAYMENT-SIGNATURE": JSON.stringify(payment),
      },
    });

    const protectedData = await protectedResponse.json();
    console.log("Protected response:", JSON.stringify(protectedData, null, 2));
  }
}

/**
 * Example 5: Access premium endpoint (higher payment required)
 */
async function examplePremiumEndpoint() {
  console.log("\n=== Example 5: Premium Endpoint ===");

  const response = await makeRequest("/api/premium-content");
  const data = await response.json();

  console.log("Response:", JSON.stringify(data, null, 2));
}

// ============================================================================
// Run Examples
// ============================================================================

async function main() {
  console.log("Armory X-402 Client Examples");
  console.log("Using address:", account.address);
  console.log("Server:", SERVER_URL);

  try {
    await examplePublicEndpoint();
    await exampleProtectedEndpoint();
    await examplePostRequest();
    await exampleGetRequirements();
    await examplePremiumEndpoint();
  } catch (error) {
    console.error("Error:", error);
  }
}

// Run if called directly
main();
