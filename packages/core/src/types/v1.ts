/**
 * Armory V1 Types - x402 Protocol V1 Compatible
 *
 * Supports both the x402 V1 specification format and legacy Armory V1 format.
 *
 * x402 V1 Specification: https://github.com/coinbase/x402
 */

import type { Address } from "./v2";

// ============================================================================
// x402 V1 Types (Coinbase compatible)
// ============================================================================

/**
 * Network name for x402 V1 (e.g., "base-sepolia", "ethereum-mainnet")
 */
export type X402V1Network = string;

/**
 * EIP-3009 authorization data (same format for V1 and V2)
 */
export interface EIP3009AuthorizationV1 {
  from: Address;
  to: Address;
  value: string;
  validAfter: string;
  validBefore: string;
  nonce: `0x${string}`;
}

/**
 * Payment requirements for a specific payment method (x402 V1)
 */
export interface X402PaymentRequirementsV1 {
  scheme: "exact";
  network: X402V1Network;
  maxAmountRequired: string;
  asset: Address;
  payTo: Address;
  resource: string;
  description: string;
  mimeType?: string;
  outputSchema?: object | null;
  maxTimeoutSeconds: number;
  extra?: Record<string, unknown>;
}

/**
 * Payment requirements response (x402 V1)
 * Matches x402 V1 PaymentRequirementsResponse spec
 */
export interface X402PaymentRequiredV1 {
  x402Version: 1;
  error: string;
  accepts: X402PaymentRequirementsV1[];
}

/**
 * Scheme payload data (x402 V1)
 */
export interface X402SchemePayloadV1 {
  signature: `0x${string}`;
  authorization: EIP3009AuthorizationV1;
}

/**
 * Payment payload (x402 V1)
 * Matches x402 V1 PaymentPayload spec
 */
export interface X402PaymentPayloadV1 {
  x402Version: 1;
  scheme: "exact";
  network: X402V1Network;
  payload: X402SchemePayloadV1;
}

/**
 * Settlement response (x402 V1)
 * Matches x402 V1 SettlementResponse spec
 */
export interface X402SettlementResponseV1 {
  success: boolean;
  errorReason?: string;
  transaction: string;
  network: X402V1Network;
  payer: Address;
}

// ============================================================================
// Legacy Armory V1 Types (for backward compatibility)
// ============================================================================

/**
 * Legacy Armory V1 payment payload format
 * @deprecated Use X402PaymentPayloadV1 for new code
 */
export interface LegacyPaymentPayloadV1 {
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

/**
 * Legacy Armory V1 payment requirements format
 * @deprecated Use X402PaymentRequirementsV1 for new code
 */
export interface LegacyPaymentRequirementsV1 {
  amount: string;
  network: string;
  contractAddress: string;
  payTo: string;
  expiry: number;
}

/**
 * Legacy Armory V1 settlement response format
 * @deprecated Use X402SettlementResponseV1 for new code
 */
export interface LegacySettlementResponseV1 {
  success: boolean;
  txHash?: string;
  error?: string;
  timestamp: number;
}

// Union types for backward compatibility
export type PaymentPayloadV1 = X402PaymentPayloadV1 | LegacyPaymentPayloadV1;
export type PaymentRequirementsV1 = X402PaymentRequirementsV1 | LegacyPaymentRequirementsV1;
export type SettlementResponseV1 = X402SettlementResponseV1 | LegacySettlementResponseV1;

// ============================================================================
// Headers
// ============================================================================

export const V1_HEADERS = {
  PAYMENT: "X-PAYMENT",
  PAYMENT_RESPONSE: "X-PAYMENT-RESPONSE",
  PAYMENT_REQUIRED: "X-PAYMENT-REQUIRED",
} as const;

// ============================================================================
// Encoding/Decoding (x402 V1 format)
// ============================================================================

export function encodeX402PaymentRequiredV1(data: X402PaymentRequiredV1): string {
  return Buffer.from(JSON.stringify(data)).toString("base64");
}

export function decodeX402PaymentRequiredV1(encoded: string): X402PaymentRequiredV1 {
  return JSON.parse(Buffer.from(encoded, "base64").toString("utf-8")) as X402PaymentRequiredV1;
}

export function encodeX402PaymentPayloadV1(data: X402PaymentPayloadV1): string {
  return Buffer.from(JSON.stringify(data)).toString("base64");
}

export function decodeX402PaymentPayloadV1(encoded: string): X402PaymentPayloadV1 {
  return JSON.parse(Buffer.from(encoded, "base64").toString("utf-8")) as X402PaymentPayloadV1;
}

export function encodeX402SettlementResponseV1(data: X402SettlementResponseV1): string {
  return Buffer.from(JSON.stringify(data)).toString("base64");
}

export function decodeX402SettlementResponseV1(encoded: string): X402SettlementResponseV1 {
  return JSON.parse(Buffer.from(encoded, "base64").toString("utf-8")) as X402SettlementResponseV1;
}

// ============================================================================
// Encoding/Decoding (Legacy format - for backward compatibility)
// ============================================================================

/**
 * @deprecated Use encodeX402PaymentPayloadV1 instead
 */
export function encodePaymentPayloadLegacy(payload: LegacyPaymentPayloadV1): string {
  return Buffer.from(JSON.stringify(payload)).toString("base64");
}

/**
 * @deprecated Use decodeX402PaymentPayloadV1 instead
 */
export function decodePaymentPayloadLegacy(encoded: string): LegacyPaymentPayloadV1 {
  return JSON.parse(Buffer.from(encoded, "base64").toString("utf-8")) as LegacyPaymentPayloadV1;
}

/**
 * @deprecated Use encodeX402SettlementResponseV1 instead
 */
export function encodeSettlementResponseLegacy(response: LegacySettlementResponseV1): string {
  return Buffer.from(JSON.stringify(response)).toString("base64");
}

/**
 * @deprecated Use decodeX402SettlementResponseV1 instead
 */
export function decodeSettlementResponseLegacy(encoded: string): LegacySettlementResponseV1 {
  return JSON.parse(Buffer.from(encoded, "base64").toString("utf-8")) as LegacySettlementResponseV1;
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Check if value is x402 V1 PaymentRequired
 */
export function isX402PaymentRequiredV1(obj: unknown): obj is X402PaymentRequiredV1 {
  return (
    typeof obj === "object" &&
    obj !== null &&
    "x402Version" in obj &&
    (obj as X402PaymentRequiredV1).x402Version === 1 &&
    "accepts" in obj &&
    Array.isArray((obj as X402PaymentRequiredV1).accepts)
  );
}

/**
 * Check if value is x402 V1 PaymentPayload
 */
export function isX402PaymentPayloadV1(obj: unknown): obj is X402PaymentPayloadV1 {
  return (
    typeof obj === "object" &&
    obj !== null &&
    "x402Version" in obj &&
    (obj as X402PaymentPayloadV1).x402Version === 1 &&
    "scheme" in obj &&
    "network" in obj &&
    "payload" in obj
  );
}

/**
 * Check if value is legacy Armory V1 format
 */
export function isLegacyPaymentPayloadV1(obj: unknown): obj is LegacyPaymentPayloadV1 {
  return (
    typeof obj === "object" &&
    obj !== null &&
    "v" in obj &&
    "r" in obj &&
    "s" in obj &&
    "chainId" in obj &&
    "contractAddress" in obj
  );
}
