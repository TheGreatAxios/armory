/**
 * Protocol Types - x402 V2 Only
 *
 * Simplified to support only x402 V2 format (Coinbase compatible)
 */

import type {
  PaymentPayloadV2,
  PaymentRequirementsV2,
  SettlementResponseV2,
  PaymentRequiredV2,
  Address,
} from "./v2";

// ============================================================================
// Type Aliases for V2 Only
// ============================================================================

export type PaymentPayload = PaymentPayloadV2;
export type PaymentRequirements = PaymentRequirementsV2;
export type SettlementResponse = SettlementResponseV2;
export type PaymentRequired = PaymentRequiredV2;

// ============================================================================
// Facilitator Communication Types (shared across middleware packages)
// ============================================================================

/**
 * Configuration for connecting to a facilitator service
 */
export interface FacilitatorConfig {
  url: string;
  createHeaders?: () => Record<string, string>;
}

/**
 * Result from facilitator verification
 */
export interface FacilitatorVerifyResult {
  success: boolean;
  payerAddress?: string;
  balance?: string;
  requiredAmount?: string;
  error?: string;
}

/**
 * Result from facilitator settlement
 */
export interface FacilitatorSettleResult {
  success: boolean;
  txHash?: string;
  error?: string;
}

/**
 * Settlement mode - verify only, settle only, or both
 */
export type SettlementMode = "verify" | "settle" | "async";

/**
 * Payment destination - address, CAIP-2 chain ID, or CAIP asset ID
 */
export type PayToAddress = Address | CAIP2ChainId | CAIPAssetId;

/**
 * CAIP-2 chain ID type (e.g., eip155:8453)
 */
export type CAIP2ChainId = `eip155:${string}`;

/**
 * CAIP-2 asset ID type (e.g., eip155:8453/erc20:0xa0b8691...)
 */
export type CAIPAssetId = `eip155:${string}/erc20:${string}`;

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Check if payload is x402 V2 format (Coinbase format)
 */
export function isX402V2Payload(obj: unknown): obj is PaymentPayloadV2 {
  return (
    typeof obj === "object" &&
    obj !== null &&
    "x402Version" in obj &&
    (obj as PaymentPayloadV2).x402Version === 2 &&
    "signature" in obj &&
    "chainId" in obj &&
    "assetId" in obj
  );
}

/**
 * Check if requirements is x402 V2 format
 */
export function isX402V2Requirements(obj: unknown): obj is PaymentRequirementsV2 {
  return (
    typeof obj === "object" &&
    obj !== null &&
    "scheme" in obj &&
    (obj as PaymentRequirementsV2).scheme === "exact" &&
    "network" in obj &&
    typeof (obj as PaymentRequirementsV2).network === "string" &&
    (obj as PaymentRequirementsV2).network.startsWith("eip155:") && // CAIP-2 format
    "amount" in obj &&
    "asset" in obj &&
    "payTo" in obj &&
    "maxTimeoutSeconds" in obj
  );
}

/**
 * Check if settlement response is x402 V2 format
 */
export function isX402V2Settlement(obj: unknown): obj is SettlementResponseV2 {
  return (
    typeof obj === "object" &&
    obj !== null &&
    "success" in obj &&
    typeof (obj as SettlementResponseV2).success === "boolean" &&
    "network" in obj &&
    typeof (obj as SettlementResponseV2).network === "string" &&
    (obj as SettlementResponseV2).network.startsWith("eip155:") // CAIP-2 format
  );
}

/**
 * Check if payment required is x402 V2 format
 */
export function isX402V2PaymentRequired(obj: unknown): obj is PaymentRequiredV2 {
  return (
    typeof obj === "object" &&
    obj !== null &&
    "x402Version" in obj &&
    (obj as PaymentRequiredV2).x402Version === 2 &&
    "resource" in obj &&
    "accepts" in obj
  );
}

// ============================================================================
// Header Names (V2 Hardcoded)
// ============================================================================

/**
 * x402 V2 payment header name
 */
export const PAYMENT_SIGNATURE_HEADER = "PAYMENT-SIGNATURE" as const;

/**
 * x402 V2 payment response header name
 */
export const PAYMENT_RESPONSE_HEADER = "PAYMENT-RESPONSE" as const;

/**
 * x402 V2 payment required header name
 */
export const PAYMENT_REQUIRED_HEADER = "PAYMENT-REQUIRED" as const;

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Check if settlement was successful
 */
export function isSettlementSuccessful(response: SettlementResponse): boolean {
  return "success" in response ? response.success : false;
}

/**
 * Get transaction hash from settlement response (V2 only)
 */
export function getTxHash(response: SettlementResponse): string | undefined {
  if ("transaction" in response) return response.transaction;
  return undefined;
}
