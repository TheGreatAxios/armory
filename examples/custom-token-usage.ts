/**
 * Custom Token Usage Example
 *
 * This example demonstrates how to register and use custom EIP-3009 compatible tokens
 * with the X-402 payment protocol.
 */

import { registerToken } from "@armory/base";

// ============================================================================
// 1. Register a Custom Token
// ============================================================================

// Register your custom token once at application startup
registerToken({
  symbol: "MYTOKEN",
  name: "My Custom Token",
  version: "1",
  contractAddress: "0x1234567890123456789012345678901234567890" as const,
  chainId: 1,
  rpcUrl: "https://eth.llamarpc.com",
  decimals: 18,
});

// You can also register tokens on other chains
registerToken({
  symbol: "MYTOKEN_BASE",
  name: "My Custom Token",
  version: "1",
  contractAddress: "0x1234567890123456789012345678901234567890" as const,
  chainId: 8453,
  rpcUrl: "https://mainnet.base.org",
  decimals: 18,
});

console.log("Custom tokens registered!");

// ============================================================================
// 2. Client-side: Create Payment with Custom Token (client-viem)
// ============================================================================

import { createX402Client } from "@armory/client-viem";
import { createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";

// Setup wallet client
const account = privateKeyToAccount("0x...");
const walletClient = createWalletClient({
  account,
  transport: http(),
});

// Create X-402 client with custom token domain overrides
const client = createX402Client({
  wallet: { type: "account", account },
  version: 2,
  domainName: "My Custom Token", // Override for custom token
  domainVersion: "1", // Override for custom token
});

// Create a payment
const payment = await client.createPayment(
  "1.0", // amount
  "0xRecipientAddress...", // recipient
  "0x1234567890123456789012345678901234567890" as const, // custom token contract
  1, // chainId
  Math.floor(Date.now() / 1000) + 3600 // expiry (1 hour from now)
);

console.log("Payment created:", payment);

// ============================================================================
// 3. Facilitator-side: Verify Custom Token Payment
// ============================================================================

import { verifyPayment } from "@armory/facilitator";
import { createNonceTracker } from "@armory/facilitator/nonce";

const nonceTracker = createNonceTracker();

// Verify payment - will use registered custom token config
const result = await verifyPayment(
  payment,
  { amount: "1.0", to: "0xRecipientAddress...", expiry: payment.expiry },
  {
    nonceTracker,
    // Optional: specify domain overrides if token isn't registered
    domainName: "My Custom Token",
    domainVersion: "1",
  }
);

if (result.success) {
  console.log("Payment verified for custom token!");
} else {
  console.error("Verification failed:", result.error.message);
}

// ============================================================================
// 4. Settle Custom Token Payment
// ============================================================================

import { settlePayment } from "@armory/facilitator/settle";

// Settle the payment on-chain
await settlePayment({
  paymentPayload: payment,
  walletClient: walletClient,
  contractAddress: "0x1234567890123456789012345678901234567890", // custom token
});

// ============================================================================
// 5. Client-side: Using client-ethers with Custom Token
// ============================================================================

import { X402Client } from "@armory/client-ethers";
import { ethers } from "ethers";

const provider = new ethers.JsonRpcProvider("https://eth.llamarpc.com");
const signer = new ethers.Wallet("0x...", provider);

const ethersClient = new X402Client({
  signer,
  protocolVersion: 2,
  domainName: "My Custom Token",
  domainVersion: "1",
});

// Make a request with automatic payment
await ethersClient.fetch("https://api.example.com/protected");

// ============================================================================
// 6. Managing Custom Tokens
// ============================================================================

import {
  getCustomToken,
  getAllCustomTokens,
  unregisterToken,
  isCustomToken,
} from "@armory/base";

// Check if a token is registered
const isCustom = isCustomToken(1, "0x1234567890123456789012345678901234567890");
console.log("Is custom token?", isCustom);

// Get token details
const token = getCustomToken(1, "0x1234567890123456789012345678901234567890");
if (token) {
  console.log("Token found:", token.symbol, token.name);
}

// List all custom tokens
const allTokens = getAllCustomTokens();
console.log("All custom tokens:", allTokens);

// Unregister a token (if needed)
unregisterToken(1, "0x1234567890123456789012345678901234567890");
console.log("Token unregistered");

// ============================================================================
// 7. Example: Registering Multiple Custom Tokens
// ============================================================================

const customTokens = [
  {
    symbol: "USDT",
    name: "Tether USD",
    version: "1",
    contractAddress: "0xdAC17F958D2ee523a2206206994597C13D831ec7" as const,
    chainId: 1,
  },
  {
    symbol: "DAI",
    name: "Dai Stablecoin",
    version: "1",
    contractAddress: "0x6B175474E89094C44Da98b954EedeAC495271d0F" as const,
    chainId: 1,
  },
  {
    symbol: "PYUSD",
    name: "PayPal USD",
    version: "1",
    contractAddress: "0x2D386a364E36827950Cf4299E656495e5A0C59Ac" as const,
    chainId: 1,
  },
];

// Register all tokens
customTokens.forEach((token) => registerToken(token));
console.log(`Registered ${customTokens.length} custom tokens`);
