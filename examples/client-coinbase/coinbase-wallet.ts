/**
 * X-402 Request with Coinbase Wallet SDK
 *
 * This demonstrates how to create a signed X-402 payment request
 * using the Coinbase Wallet SDK for browser-based applications.
 *
 * NOTE: This example is designed for browser environments.
 * For Node.js environments, use the ethers or viem examples instead.
 */

import type { PaymentPayloadV2 } from "@armory/base";
import {
  createEIP712Domain,
  createTransferWithAuthorization,
} from "@armory/base";
import CoinbaseWalletSDK from "@coinbase/wallet-sdk";

const FACILITATOR_URL = process.env.FACILITATOR_URL ?? "http://localhost:3000";

// Base Mainnet USDC address
const USDC_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const CHAIN_ID = 8453; // Base

// ============================================================================
// Initialize Coinbase Wallet SDK
// ============================================================================

function initializeCoinbaseWallet() {
  const appMetadata = {
    name: "X-402 Payment Example",
    iconUrl: "https://example.com/icon.png",
    description: "Example X-402 payment integration with Coinbase Wallet",
  };

  const sdk = new CoinbaseWalletSDK(appMetadata);

  // Create a provider for Base network
  const provider = sdk.makeWeb3Provider(
    `https://mainnet.base.org`, // Base RPC URL
    CHAIN_ID,
  );

  return { sdk, provider };
}

// ============================================================================
// Connect Wallet
// ============================================================================

async function connectWallet(
  provider: ReturnType<CoinbaseWalletSDK["makeWeb3Provider"]>,
) {
  try {
    const accounts = await provider.request({
      method: "eth_requestAccounts",
    });

    if (!accounts || accounts.length === 0) {
      throw new Error("No accounts returned from wallet");
    }

    return accounts[0] as `0x${string}`;
  } catch (error) {
    console.error("Failed to connect wallet:", error);
    throw error;
  }
}

// ============================================================================
// Sign EIP-712 Typed Data (EIP-3009 TransferWithAuthorization)
// ============================================================================

async function signTransferWithAuthorization(
  provider: ReturnType<CoinbaseWalletSDK["makeWeb3Provider"]>,
  fromAddress: `0x${string}`,
  to: string,
  amount: bigint,
  validBefore: number,
  nonce: string,
): Promise<{ r: `0x${string}`; s: `0x${string}`; v: number }> {
  // Create the EIP-712 domain
  const domain = createEIP712Domain(CHAIN_ID, USDC_ADDRESS);

  // Create the message
  const message = createTransferWithAuthorization({
    from: fromAddress,
    to: to as `0x${string}`,
    value: amount,
    validAfter: 0n,
    validBefore,
    nonce: BigInt(nonce),
  });

  // Prepare typed data for signing
  const typedData = {
    types: {
      EIP712Domain: [
        { name: "name", type: "string" },
        { name: "version", type: "string" },
        { name: "chainId", type: "uint256" },
        { name: "verifyingContract", type: "address" },
      ],
      TransferWithAuthorization: [
        { name: "from", type: "address" },
        { name: "to", type: "address" },
        { name: "value", type: "uint256" },
        { name: "validAfter", type: "uint256" },
        { name: "validBefore", type: "uint256" },
        { name: "nonce", type: "uint256" },
      ],
    },
    primaryType: "TransferWithAuthorization" as const,
    domain: {
      name: domain.name,
      version: domain.version,
      chainId: domain.chainId,
      verifyingContract: domain.verifyingContract,
    },
    message: {
      from: message.from,
      to: message.to,
      value: message.value.toString(),
      validAfter: message.validAfter.toString(),
      validBefore: message.validBefore.toString(),
      nonce: message.nonce.toString(),
    },
  };

  // Request signature from wallet
  const signature = await provider.request({
    method: "eth_signTypedData_v4",
    params: [fromAddress, JSON.stringify(typedData)],
  });

  // Parse signature into components
  const r = `0x${signature.slice(2, 66)}` as `0x${string}`;
  const s = `0x${signature.slice(66, 130)}` as `0x${string}`;
  const v = parseInt(signature.slice(130, 132), 16);

  return { r, s, v };
}

// ============================================================================
// Create Payment Payload from Coinbase Wallet
// ============================================================================

async function createPaymentPayloadFromCoinbaseWallet(
  provider: ReturnType<CoinbaseWalletSDK["makeWeb3Provider"]>,
  fromAddress: `0x${string}`,
  to: string,
  amount: bigint,
): Promise<PaymentPayloadV2> {
  const nonce = Date.now().toString();
  const validBefore = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now

  // Sign the transfer authorization
  const signature = await signTransferWithAuthorization(
    provider,
    fromAddress,
    to,
    amount,
    validBefore,
    nonce,
  );

  return {
    from: fromAddress,
    to: to as `0x${string}`,
    amount: amount.toString(),
    nonce,
    expiry: validBefore,
    chainId: `eip155:${CHAIN_ID}` as const,
    assetId: `eip155:${CHAIN_ID}/erc20:${USDC_ADDRESS}` as const,
    signature: {
      v: signature.v,
      r: signature.r,
      s: signature.s,
    },
  };
}

// ============================================================================
// Example: Send Payment Request
// ============================================================================

async function sendPaymentRequest(
  paymentPayload: PaymentPayloadV2,
  recipientAddress: string,
  requiredAmount: string,
): Promise<void> {
  const paymentRequirements = {
    to: recipientAddress as `0x${string}`,
    amount: requiredAmount,
    expiry: paymentPayload.expiry,
  };

  const response = await fetch(`${FACILITATOR_URL}/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      paymentPayload,
      paymentRequirements,
      skipBalanceCheck: false, // Check balance
      skipNonceCheck: false, // Check nonce
    }),
  });

  const data = await response.json();
  console.log("Payment Verification:", JSON.stringify(data, null, 2));

  if (data.success) {
    console.log("Payment verified successfully!");
    console.log("Payer:", data.payerAddress);
    console.log("Balance:", data.balance);
    console.log("Required:", data.requiredAmount);
  } else {
    console.error("Payment verification failed:", data.error);
  }
}

// ============================================================================
// Example: Settle Payment
// ============================================================================

async function settlePayment(
  paymentPayload: PaymentPayloadV2,
  recipientAddress: string,
  requiredAmount: string,
): Promise<void> {
  const paymentRequirements = {
    to: recipientAddress as `0x${string}`,
    amount: requiredAmount,
    expiry: paymentPayload.expiry,
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
  console.log("Settle Payment:", JSON.stringify(data, null, 2));

  if (data.success) {
    console.log("Payment submitted for settlement!");
    if (data.jobId) {
      console.log("Job ID:", data.jobId);
    }
    if (data.txHash) {
      console.log("Transaction Hash:", data.txHash);
    }
  } else {
    console.error("Settlement failed:", data.error);
  }
}

// ============================================================================
// Main Execution (Browser Environment)
// ============================================================================

async function main(): Promise<void> {
  console.log("X-402 Client (Coinbase Wallet SDK) - Example\n");

  try {
    // Initialize Coinbase Wallet SDK
    console.log("1. Initialize Coinbase Wallet SDK");
    const { provider } = initializeCoinbaseWallet();
    console.log("");

    // Connect wallet
    console.log("2. Connect Wallet");
    const walletAddress = await connectWallet(provider);
    console.log("Connected:", walletAddress);
    console.log("");

    // Payment details
    const recipientAddress = "0x1234567890123456789012345678901234567890";
    const amount = 1000000n; // 1 USDC (6 decimals)
    const requiredAmount = "1000000";

    console.log("3. Create Payment Payload");
    console.log("Recipient:", recipientAddress);
    console.log("Amount:", amount.toString(), "(1 USDC)");
    console.log("");

    const paymentPayload = await createPaymentPayloadFromCoinbaseWallet(
      provider,
      walletAddress,
      recipientAddress,
      amount,
    );

    console.log("Payment Payload:");
    console.log("  From:", paymentPayload.from);
    console.log("  To:", paymentPayload.to);
    console.log("  Amount:", paymentPayload.amount);
    console.log("  Nonce:", paymentPayload.nonce);
    console.log("  Expiry:", paymentPayload.expiry);
    console.log(
      "  Signature:",
      `${paymentPayload.signature.r.slice(0, 10)}...`,
    );
    console.log("");

    console.log("4. Verify Payment");
    await sendPaymentRequest(paymentPayload, recipientAddress, requiredAmount);
    console.log("");

    console.log("5. Settle Payment");
    await settlePayment(paymentPayload, recipientAddress, requiredAmount);
    console.log("");
  } catch (error) {
    console.error("Error:", error);
    console.log(
      "\nNote: This example requires a browser environment with Coinbase Wallet installed.",
    );
    console.log(
      "For Node.js environments, use the ethers or viem examples instead.",
    );
  }
}

// Export for use in browser or testing
export {
  main,
  initializeCoinbaseWallet,
  connectWallet,
  createPaymentPayloadFromCoinbaseWallet,
};

// Auto-run if in browser environment
if (typeof window !== "undefined" && import.meta.main) {
  // Add a button to trigger the payment flow
  const button = document.createElement("button");
  button.textContent = "Initiate X-402 Payment";
  button.style.cssText =
    "padding: 12px 24px; font-size: 16px; cursor: pointer;";
  button.onclick = main;
  document.body.appendChild(button);
}
