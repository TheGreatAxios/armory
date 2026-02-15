/**
 * X402 Protocol Types - Coinbase Compatible Format
 * 
 * This module provides types that match the official Coinbase x402 SDK format
 * for full interoperability with their facilitator and extensions.
 */

export type Address = `0x${string}`;
export type Hex = `0x${string}`;

// X402 Protocol Version
export const X402_VERSION = 2 as const;
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
 * Resource information for payment payload
 */
export interface ResourceInfo {
  url: string;
  description?: string;
  mimeType?: string;
}

/**
 * Payment payload - Coinbase compatible format (x402 v2)
 * Uses 'accepted' field to echo server's requirements
 */
export interface PaymentPayload {
  x402Version: X402Version;
  accepted: PaymentRequirements;
  payload: ExactEvmPayload;
  resource?: ResourceInfo;
  extensions?: Record<string, unknown>;
}

/**
 * Unsigned payment payload (before signing)
 */
export interface UnsignedPaymentPayload {
  x402Version: X402Version;
  accepted: PaymentRequirements;
  payload: Omit<ExactEvmPayload, "signature"> & { signature: undefined };
  resource?: ResourceInfo;
  extensions?: Record<string, unknown>;
}

/**
 * Payment requirements for 402 response
 * Matches x402 SDK format
 */
export interface PaymentRequirements {
  scheme: Scheme;
  network: Network;
  maxAmountRequired: string;       // Atomic units (x402 SDK format - sent to facilitator)
  payTo: Address;
  maxTimeoutSeconds: number;
  asset: Address;                  // Token contract address
  name?: string;                    // EIP-712 domain parameter
  version?: string;                 // EIP-712 domain parameter
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

/**
 * Type guards
 */
export function isPaymentPayload(obj: unknown): obj is PaymentPayload {
  return (
    typeof obj === "object" &&
    obj !== null &&
    "x402Version" in obj &&
    "accepted" in obj &&
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
