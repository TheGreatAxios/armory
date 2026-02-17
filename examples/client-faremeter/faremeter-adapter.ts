/**
 * X-402 Faremeter Adapter Example
 *
 * This demonstrates an adapter that converts faremeter-style payment requests
 * into X-402 compatible payment payloads.
 *
 * Faremeter is a hypothetical payment protocol that this adapter makes compatible
 * with the X-402 standard.
 */

import type { PaymentPayloadV2, PaymentRequirementsV2 } from "@armory/base";

const FACILITATOR_URL = process.env.FACILITATOR_URL ?? "http://localhost:3000";

// ============================================================================
// Faremeter Types (Hypothetical Protocol)
// ============================================================================

/**
 * Faremeter payment request structure
 * This represents the existing payment format that needs to be adapted
 */
interface FaremeterPaymentRequest {
  /** Payer wallet address */
  payer: string;
  /** Recipient address */
  recipient: string;
  /** Amount in smallest unit (e.g., wei, satoshi) */
  amount: string;
  /** Currency code (USD, EUR, etc.) */
  currency: string;
  /** Timestamp when payment was created */
  timestamp: number;
  /** Unique payment reference */
  reference: string;
  /** Expiration in seconds */
  expires_in: number;
  /** Signature from payer */
  signature: {
    /** r value of ECDSA signature */
    r: string;
    /** s value of ECDSA signature */
    s: string;
    /** v value of ECDSA signature */
    v: number;
  };
}

/**
 * Faremeter payment response
 */
interface FaremeterPaymentResponse {
  success: boolean;
  transaction_id?: string;
  error?: string;
}

// ============================================================================
// Network Configuration
// ============================================================================

/**
 * Currency to network/asset mapping for faremeter
 */
const CURRENCY_ASSET_MAP: Record<
  string,
  { chainId: number; usdcAddress: string }
> = {
  USD: {
    chainId: 8453, // Base
    usdcAddress: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  },
  EUR: {
    chainId: 1, // Ethereum
    usdcAddress: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
  },
};

// ============================================================================
// Faremeter to X-402 Adapter
// ============================================================================

function toX402PaymentPayload(
  request: FaremeterPaymentRequest,
): PaymentPayloadV2 {
  const networkConfig =
    CURRENCY_ASSET_MAP[request.currency] ?? CURRENCY_ASSET_MAP.USD;

  return {
    from: request.payer as `0x${string}`,
    to: request.recipient as `0x${string}`,
    amount: request.amount,
    nonce: request.reference,
    expiry: Math.floor(request.timestamp / 1000) + request.expires_in,
    chainId: `eip155:${networkConfig.chainId}` as const,
    assetId:
      `eip155:${networkConfig.chainId}/erc20:${networkConfig.usdcAddress}` as const,
    signature: {
      v: request.signature.v,
      r: request.signature.r as `0x${string}`,
      s: request.signature.s as `0x${string}`,
    },
  };
}

function toX402PaymentRequirements(
  request: FaremeterPaymentRequest,
): PaymentRequirementsV2 {
  return {
    to: request.recipient as `0x${string}`,
    amount: request.amount,
    expiry: Math.floor(request.timestamp / 1000) + request.expires_in,
  };
}

function fromX402Response(x402Response: {
  success: boolean;
  txHash?: string;
  error?: string;
}): FaremeterPaymentResponse {
  return {
    success: x402Response.success,
    transaction_id: x402Response.txHash,
    error: x402Response.error,
  };
}

// ============================================================================
// Example: Create Faremeter Payment Request
// ============================================================================

function createFaremeterPaymentRequest(
  payer: string,
  recipient: string,
  amount: string,
  currency: string,
  signature: { r: string; s: string; v: number },
): FaremeterPaymentRequest {
  return {
    payer,
    recipient,
    amount,
    currency,
    timestamp: Date.now(),
    reference: `fm_${Date.now()}_${Math.random().toString(36).substring(7)}`,
    expires_in: 3600, // 1 hour
    signature,
  };
}

// ============================================================================
// Example: Verify Payment with Adapter
// ============================================================================

async function verifyFaremeterPayment(
  request: FaremeterPaymentRequest,
): Promise<FaremeterPaymentResponse> {
  // Convert faremeter request to X-402 format
  const paymentPayload = toX402PaymentPayload(request);
  const paymentRequirements = toX402PaymentRequirements(request);

  // Send to X-402 facilitator
  const response = await fetch(`${FACILITATOR_URL}/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      paymentPayload,
      paymentRequirements,
      skipBalanceCheck: false,
      skipNonceCheck: false,
    }),
  });

  const data = await response.json();

  // Convert response back to faremeter format
  return fromX402Response({
    success: data.success,
    error: data.error,
  });
}

// ============================================================================
// Example: Settle Payment with Adapter
// ============================================================================

async function settleFaremeterPayment(
  request: FaremeterPaymentRequest,
): Promise<FaremeterPaymentResponse> {
  // Convert faremeter request to X-402 format
  const paymentPayload = toX402PaymentPayload(request);
  const paymentRequirements = toX402PaymentRequirements(request);

  // Send to X-402 facilitator
  const response = await fetch(`${FACILITATOR_URL}/settle`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      paymentPayload,
      paymentRequirements,
      enqueue: true,
    }),
  });

  const data = await response.json();

  // Convert response back to faremeter format
  return fromX402Response({
    success: data.success,
    txHash: data.txHash,
    error: data.error,
  });
}

// ============================================================================
// Mock Signature Generator for Testing
// ============================================================================

function createMockSignature(): { r: string; s: string; v: number } {
  return {
    r: `0x${"0".repeat(64)}`,
    s: `0x${"0".repeat(64)}`,
    v: 27,
  };
}

// ============================================================================
// Main Execution
// ============================================================================

async function main(): Promise<void> {
  console.log("X-402 Faremeter Adapter Example\n");

  // Create a mock faremeter payment request
  console.log("1. Create Faremeter Payment Request");
  const faremeterRequest = createFaremeterPaymentRequest(
    "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
    "0x1234567890123456789012345678901234567890",
    "1000000", // 1 USDC
    "USD",
    createMockSignature(),
  );

  console.log("Faremeter Request:");
  console.log("  Payer:", faremeterRequest.payer);
  console.log("  Recipient:", faremeterRequest.recipient);
  console.log("  Amount:", faremeterRequest.amount);
  console.log("  Currency:", faremeterRequest.currency);
  console.log("  Reference:", faremeterRequest.reference);
  console.log("  Expires In:", faremeterRequest.expires_in, "seconds");
  console.log("");

  // Convert to X-402 format
  console.log("2. Convert to X-402 Format");
  const x402Payload = toX402PaymentPayload(faremeterRequest);
  const x402Requirements = toX402PaymentRequirements(faremeterRequest);

  console.log("X-402 Payment Payload:");
  console.log("  From:", x402Payload.from);
  console.log("  To:", x402Payload.to);
  console.log("  Amount:", x402Payload.amount);
  console.log("  Chain ID:", x402Payload.chainId);
  console.log("  Asset ID:", x402Payload.assetId);
  console.log("  Nonce:", x402Payload.nonce);
  console.log("  Expiry:", x402Payload.expiry);
  console.log("");

  console.log("X-402 Payment Requirements:");
  console.log("  To:", x402Requirements.to);
  console.log("  Amount:", x402Requirements.amount);
  console.log("  Expiry:", x402Requirements.expiry);
  console.log("");

  // Verify payment
  console.log("3. Verify Payment");
  const verifyResult = await verifyFaremeterPayment(faremeterRequest);
  console.log("Verification Result:", JSON.stringify(verifyResult, null, 2));
  console.log("");

  // Settle payment
  console.log("4. Settle Payment");
  const settleResult = await settleFaremeterPayment(faremeterRequest);
  console.log("Settlement Result:", JSON.stringify(settleResult, null, 2));
  console.log("");
}

// Run if executed directly
if (import.meta.main) {
  main().catch(console.error);
}

// Export adapter for use in other modules
export {
  fromX402Response,
  toX402PaymentPayload,
  toX402PaymentRequirements,
  type FaremeterPaymentRequest,
  type FaremeterPaymentResponse,
};
