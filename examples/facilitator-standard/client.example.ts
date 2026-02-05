/**
 * Example client for testing the X-402 facilitator
 *
 * This demonstrates how to create payment payloads and interact
 * with the facilitator endpoints.
 */

import { createWalletClient, http } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

const FACILITATOR_URL = process.env.FACILITATOR_URL ?? "http://localhost:3000";

// ============================================================================
// Example: Health Check
// ============================================================================

async function healthCheck() {
  const response = await fetch(`${FACILITATOR_URL}/health`);
  const data = await response.json();

  console.log("Health Check:", data);
  return data;
}

// ============================================================================
// Example: Supported Networks
// ============================================================================

async function getSupportedNetworks() {
  const response = await fetch(`${FACILITATOR_URL}/supported`);
  const data = await response.json();

  console.log("Supported Networks:", data);
  return data;
}

// ============================================================================
// Example: Verify Payment
// ============================================================================

async function verifyPayment() {
  // This would typically come from the X-PAYMENT or PAYMENT-SIGNATURE header
  const paymentPayload = {
    from: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
    to: "0x1234567890123456789012345678901234567890",
    amount: "1000000", // 1 USDC (6 decimals)
    nonce: Date.now().toString(),
    expiry: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
    chainId: "eip155:8453",
    assetId: "eip155:8453/erc20:0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
    signature: {
      v: 27,
      r: "0x" + "0".padStart(64, "0"),
      s: "0x" + "0".padStart(64, "0"),
    },
  };

  const paymentRequirements = {
    to: "0x1234567890123456789012345678901234567890",
    amount: "1000000",
    expiry: Math.floor(Date.now() / 1000) + 3600,
  };

  const response = await fetch(`${FACILITATOR_URL}/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      paymentPayload,
      paymentRequirements,
      skipBalanceCheck: true, // Skip for testing
      skipNonceCheck: true, // Skip for testing
    }),
  });

  const data = await response.json();
  console.log("Verify Payment:", data);
  return data;
}

// ============================================================================
// Example: Settle Payment (Async)
// ============================================================================

async function settlePayment() {
  const paymentPayload = {
    from: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
    to: "0x1234567890123456789012345678901234567890",
    amount: "1000000",
    nonce: Date.now().toString(),
    expiry: Math.floor(Date.now() / 1000) + 3600,
    chainId: "eip155:8453",
    assetId: "eip155:8453/erc20:0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
    signature: {
      v: 27,
      r: "0x" + "0".padStart(64, "0"),
      s: "0x" + "0".padStart(64, "0"),
    },
  };

  const paymentRequirements = {
    to: "0x1234567890123456789012345678901234567890",
    amount: "1000000",
    expiry: Math.floor(Date.now() / 1000) + 3600,
  };

  const response = await fetch(`${FACILITATOR_URL}/settle`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      paymentPayload,
      paymentRequirements,
      enqueue: true, // Background processing
    }),
  });

  const data = await response.json();
  console.log("Settle Payment:", data);
  return data;
}

// ============================================================================
// Run Examples
// ============================================================================

async function main() {
  console.log("X-402 Facilitator Client Examples\n");

  console.log("1. Health Check");
  await healthCheck();
  console.log("");

  console.log("2. Supported Networks");
  await getSupportedNetworks();
  console.log("");

  console.log("3. Verify Payment");
  await verifyPayment();
  console.log("");

  console.log("4. Settle Payment");
  await settlePayment();
  console.log("");
}

// Run if executed directly
if (import.meta.main) {
  main().catch(console.error);
}
