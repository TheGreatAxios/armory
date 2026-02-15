/**
 * X402 Protocol Types - Coinbase Compatible Format
 * 
 * This module provides types that match the official Coinbase x402 SDK format
 * for full interoperability with their facilitator and extensions.
 */

export type Address = `0x${string}`;
export type Hex = `0x${string}`;

// X402 Protocol Version
export const X402_VERSION = 1 as const;
export type X402Version = typeof X402_VERSION;

// Supported schemes
export const SCHEMES = ["exact"] as const;
export type Scheme = (typeof SCHEMES)[number];

// Supported networks (CAIP-2 format)
export type Network = 
  | "base" 
  | "base-sepolia" 
  | "ethereum" 
  | "ethereum-sepolia"
  | "polygon"
  | "polygon-amoy"
  | "arbitrum"
  | "arbitrum-sepolia"
  | "optimism"
  | "optimism-sepolia"
  | string; // For custom networks

// Chain ID to network mapping
const CHAIN_ID_TO_NETWORK: Record<number, Network> = {
  1: "ethereum",
  8453: "base",
  84532: "base-sepolia",
  137: "polygon",
  42161: "arbitrum",
  421614: "arbitrum-sepolia",
  10: "optimism",
  11155420: "optimism-sepolia",
  11155111: "ethereum-sepolia",
};

/**
 * EIP-3009 TransferWithAuthorization authorization data
 */
export interface ExactEvmAuthorization {
  from: Address;
  to: Address;
  value: string;        // Atomic units (e.g., "1500000" for 1.5 USDC)
  validAfter: string;   // Unix timestamp as string
  validBefore: string;  // Unix timestamp as string (expiry)
  nonce: Hex;           // 32-byte hex string (bytes32)
}

/**
 * Exact EVM payment payload structure
 */
export interface ExactEvmPayload {
  signature: Hex;       // Full hex signature (0x + r + s + v)
  authorization: ExactEvmAuthorization;
}

/**
 * Payment payload - Coinbase compatible format
 * This is the unified format that works with both v1 and v2
 */
export interface PaymentPayload {
  x402Version: X402Version;
  scheme: Scheme;
  network: Network;
  payload: ExactEvmPayload;
}

/**
 * Unsigned payment payload (before signing)
 */
export interface UnsignedPaymentPayload {
  x402Version: X402Version;
  scheme: Scheme;
  network: Network;
  payload: Omit<ExactEvmPayload, "signature"> & { signature: undefined };
}

/**
 * Payment requirements for 402 response
 * Matches x402 SDK format
 */
export interface PaymentRequirements {
  scheme: Scheme;
  network: Network;
  amount: string;               // Atomic units (x402 SDK expects 'amount')
  payTo: Address;
  maxTimeoutSeconds: number;
  asset: Address;               // Token contract address
  name?: string;                // EIP-712 domain parameter
  version?: string;             // EIP-712 domain parameter
  extra?: Record<string, unknown>;  // Additional extensions
}

/**
 * Settlement response
 */
export interface SettlementResponse {
  success: boolean;
  errorReason?: string;
  payer?: Address;
  transaction: string;    // Transaction hash
  network: Network;
}

/**
 * Verify response
 */
export interface VerifyResponse {
  isValid: boolean;
  invalidReason?: string;
  payer?: Address;
}

/**
 * X402 response structure for 402 errors
 */
export interface X402Response {
  x402Version: X402Version;
  error?: string;
  accepts?: PaymentRequirements[];
  payer?: Address;
}

// Legacy types for backward compatibility
export interface PaymentPayloadV1 {
  from: string;
  to: string;
  amount: string;
  nonce: string;
  expiry: number;
  v: number;
  r: string;
  s: string;
  chainId: number;
  contractAddress: string;
  network: string;
}

export interface PaymentPayloadV2 {
  from: Address;
  to: Address | { role?: string; callback?: string };
  amount: string;
  nonce: string;
  expiry: number;
  signature: {
    v: number;
    r: string;
    s: string;
  };
  chainId: `eip155:${string}`;
  assetId: `eip155:${string}/erc20:${string}`;
  extensions?: Record<string, unknown>;
}

export type LegacyPaymentPayload = PaymentPayloadV1 | PaymentPayloadV2;

/**
 * Type guards
 */
export function isPaymentPayload(obj: unknown): obj is PaymentPayload {
  return (
    typeof obj === "object" &&
    obj !== null &&
    "x402Version" in obj &&
    "scheme" in obj &&
    "network" in obj &&
    "payload" in obj
  );
}

export function isExactEvmPayload(obj: unknown): obj is ExactEvmPayload {
  return (
    typeof obj === "object" &&
    obj !== null &&
    "signature" in obj &&
    "authorization" in obj
  );
}

// Helper functions for legacy conversion (not closures)
function extractNetworkFromLegacy(legacy: LegacyPaymentPayload): Network {
  if ("network" in legacy && typeof legacy.network === "string") {
    return legacy.network as Network;
  }
  
  if ("chainId" in legacy && typeof legacy.chainId === "string") {
    const match = legacy.chainId.match(/^eip155:(\d+)$/);
    if (match) {
      const chainId = parseInt(match[1], 10);
      return CHAIN_ID_TO_NETWORK[chainId] || `eip155:${chainId}`;
    }
  }
  
  if ("chainId" in legacy && typeof legacy.chainId === "number") {
    return CHAIN_ID_TO_NETWORK[legacy.chainId] || `eip155:${legacy.chainId}`;
  }
  
  return "base";
}

function extractAssetFromLegacy(legacy: LegacyPaymentPayload): Address {
  if ("contractAddress" in legacy && typeof legacy.contractAddress === "string") {
    return legacy.contractAddress as Address;
  }
  
  if ("assetId" in legacy && typeof legacy.assetId === "string") {
    const match = legacy.assetId.match(/:0x[a-fA-F0-9]{40}$/);
    if (match) {
      return match[0].slice(1) as Address;
    }
  }
  
  return "0x0000000000000000000000000000000000000000" as Address;
}

function extractSignatureFromLegacy(legacy: LegacyPaymentPayload): Hex {
  if ("v" in legacy && "r" in legacy && "s" in legacy) {
    // V1 format: v, r, s are separate
    const v = legacy.v.toString(16).padStart(2, "0");
    const r = legacy.r.startsWith("0x") ? legacy.r.slice(2) : legacy.r;
    const s = legacy.s.startsWith("0x") ? legacy.s.slice(2) : legacy.s;
    return `0x${r}${s}${v}` as Hex;
  }
  
  if ("signature" in legacy && typeof legacy.signature === "object" && legacy.signature !== null) {
    // V2 format: signature object
    const sig = legacy.signature as { v: number; r: string; s: string };
    const v = sig.v.toString(16).padStart(2, "0");
    const r = sig.r.startsWith("0x") ? sig.r.slice(2) : sig.r;
    const s = sig.s.startsWith("0x") ? sig.s.slice(2) : sig.s;
    return `0x${r}${s}${v}` as Hex;
  }
  
  return "0x" as Hex;
}

function convertAmountToAtomic(amount: string): string {
  if (amount.includes(".")) {
    const parts = amount.split(".");
    const whole = parts[0];
    const fractional = parts[1] || "";
    const paddedFractional = fractional.padEnd(6, "0").slice(0, 6);
    return `${whole}${paddedFractional}`;
  }
  return amount;
}

function convertNonceToHex(nonce: string): Hex {
  if (nonce.startsWith("0x") && nonce.length === 66) {
    return nonce as Hex;
  }
  const hex = BigInt(nonce).toString(16).padStart(64, "0");
  return `0x${hex}` as Hex;
}

function extractFromAddress(legacy: LegacyPaymentPayload): Address {
  return legacy.from as Address;
}

function extractToAddress(legacy: LegacyPaymentPayload): Address {
  if ("to" in legacy && typeof legacy.to === "string") {
    return legacy.to as Address;
  }
  return legacy.from as Address;
}

/**
 * Convert legacy payload to new format
 */
export function legacyToPaymentPayload(legacy: LegacyPaymentPayload | PaymentPayload): PaymentPayload {
  if (isPaymentPayload(legacy)) {
    return legacy;
  }

  const network = extractNetworkFromLegacy(legacy);
  const signature = extractSignatureFromLegacy(legacy);
  const value = convertAmountToAtomic(legacy.amount);
  const nonce = convertNonceToHex(legacy.nonce);
  const from = extractFromAddress(legacy);
  const to = extractToAddress(legacy);

  return {
    x402Version: X402_VERSION,
    scheme: "exact",
    network,
    payload: {
      signature,
      authorization: {
        from,
        to,
        value,
        validAfter: "0",
        validBefore: legacy.expiry.toString(),
        nonce,
      },
    },
  };
}
