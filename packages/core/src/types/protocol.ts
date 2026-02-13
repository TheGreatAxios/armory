/**
 * Protocol Union Types and Version Detection
 *
 * Handles both x402 V1 and V2 formats along with legacy Armory formats
 */

import type {
  PaymentPayloadV1,
  PaymentRequirementsV1,
  SettlementResponseV1,
  X402PaymentPayloadV1,
  X402PaymentRequiredV1,
  X402PaymentRequirementsV1,
  X402SettlementResponseV1,
  LegacyPaymentPayloadV1,
  LegacyPaymentRequirementsV1,
  LegacySettlementResponseV1,
} from "./v1";
import type {
  PaymentPayloadV2,
  PaymentRequirementsV2,
  SettlementResponseV2,
  PaymentRequiredV2,
} from "./v2";

// ============================================================================
// Union Types
// ============================================================================

/**
 * All x402 compatible payment payload types
 */
export type PaymentPayload = X402PaymentPayloadV1 | PaymentPayloadV2 | LegacyPaymentPayloadV1;

/**
 * All x402 compatible payment requirements types
 */
export type PaymentRequirements =
  | X402PaymentRequirementsV1
  | PaymentRequirementsV2
  | LegacyPaymentRequirementsV1;

/**
 * All x402 compatible settlement response types
 */
export type SettlementResponse = X402SettlementResponseV1 | SettlementResponseV2 | LegacySettlementResponseV1;

/**
 * All x402 compatible payment required response types
 */
export type PaymentRequired = X402PaymentRequiredV1 | PaymentRequiredV2;

// ============================================================================
// Version Detection
// ============================================================================

/**
 * Check if payload is x402 V1 format
 */
export function isX402V1Payload(obj: unknown): obj is X402PaymentPayloadV1 {
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
 * Check if payload is x402 V2 format
 */
export function isX402V2Payload(obj: unknown): obj is PaymentPayloadV2 {
  return (
    typeof obj === "object" &&
    obj !== null &&
    "x402Version" in obj &&
    (obj as PaymentPayloadV2).x402Version === 2 &&
    "accepted" in obj &&
    "payload" in obj
  );
}

/**
 * Check if payload is legacy Armory V1 format
 */
export function isLegacyV1Payload(obj: unknown): obj is LegacyPaymentPayloadV1 {
  return (
    typeof obj === "object" &&
    obj !== null &&
    "v" in obj &&
    "r" in obj &&
    "s" in obj &&
    "chainId" in obj &&
    "contractAddress" in obj &&
    !("x402Version" in obj)
  );
}

/**
 * Check if payload is legacy Armory V2 format
 */
export function isLegacyV2Payload(obj: unknown): boolean {
  if (typeof obj !== "object" || obj === null) return false;

  const record = obj as Record<string, unknown>;
  const signature = record.signature;

  return (
    "signature" in record &&
    typeof signature === "object" &&
    signature !== null &&
    "v" in signature &&
    "chainId" in record &&
    typeof record.chainId === "string" &&
    record.chainId.startsWith("eip155:") &&
    "assetId" in record &&
    !("x402Version" in record)
  );
}

/**
 * Get x402 version from payload
 */
export function getPaymentVersion(payload: PaymentPayload): 1 | 2 {
  if (isX402V1Payload(payload)) return 1;
  if (isX402V2Payload(payload)) return 2;
  // Legacy format defaults to V1
  return 1;
}

/**
 * Check if requirements is x402 V1 format
 */
export function isX402V1Requirements(obj: unknown): obj is X402PaymentRequirementsV1 {
  return (
    typeof obj === "object" &&
    obj !== null &&
    "scheme" in obj &&
    "network" in obj &&
    typeof (obj as X402PaymentRequirementsV1).network === "string" &&
    !(obj as X402PaymentRequirementsV1).network.includes(":") && // Not CAIP-2 format
    "maxAmountRequired" in obj
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
    "network" in obj &&
    typeof (obj as PaymentRequirementsV2).network === "string" &&
    (obj as PaymentRequirementsV2).network.startsWith("eip155:") && // CAIP-2 format
    "amount" in obj
  );
}

/**
 * Get x402 version from requirements
 */
export function getRequirementsVersion(requirements: PaymentRequirements): 1 | 2 {
  if (isX402V1Requirements(requirements)) return 1;
  if (isX402V2Requirements(requirements)) return 2;
  // Legacy format defaults to V1
  return 1;
}

/**
 * Check if settlement response is x402 V1 format
 */
export function isX402V1Settlement(obj: unknown): obj is X402SettlementResponseV1 {
  return (
    typeof obj === "object" &&
    obj !== null &&
    "success" in obj &&
    "network" in obj &&
    typeof (obj as X402SettlementResponseV1).network === "string" &&
    !(obj as X402SettlementResponseV1).network.includes(":") // Not CAIP-2 format
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
    "network" in obj &&
    typeof (obj as SettlementResponseV2).network === "string" &&
    (obj as SettlementResponseV2).network.startsWith("eip155:") // CAIP-2 format
  );
}

/**
 * Get x402 version from settlement response
 */
export function getSettlementVersion(response: SettlementResponse): 1 | 2 {
  if (isX402V1Settlement(response)) return 1;
  if (isX402V2Settlement(response)) return 2;
  // Legacy format defaults to V1
  return 1;
}

/**
 * Check if payment required is x402 V1 format
 */
export function isX402V1PaymentRequired(obj: unknown): obj is X402PaymentRequiredV1 {
  return (
    typeof obj === "object" &&
    obj !== null &&
    "x402Version" in obj &&
    (obj as X402PaymentRequiredV1).x402Version === 1 &&
    "accepts" in obj
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

/**
 * Get x402 version from payment required
 */
export function getPaymentRequiredVersion(obj: PaymentRequired): 1 | 2 {
  if (isX402V1PaymentRequired(obj)) return 1;
  if (isX402V2PaymentRequired(obj)) return 2;
  return 1;
}

// ============================================================================
// Header Names
// ============================================================================

/**
 * Get payment header name for version
 */
export function getPaymentHeaderName(version: 1 | 2): string {
  return version === 1 ? "X-PAYMENT" : "PAYMENT-SIGNATURE";
}

/**
 * Get payment response header name for version
 */
export function getPaymentResponseHeaderName(version: 1 | 2): string {
  return version === 1 ? "X-PAYMENT-RESPONSE" : "PAYMENT-RESPONSE";
}

/**
 * Get payment required header name for version
 */
export function getPaymentRequiredHeaderName(version: 1 | 2): string {
  return version === 1 ? "X-PAYMENT-REQUIRED" : "PAYMENT-REQUIRED";
}

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
 * Get transaction hash from settlement response
 */
export function getTxHash(response: SettlementResponse): string | undefined {
  if ("transaction" in response) return response.transaction;
  if ("txHash" in response) return response.txHash;
  return undefined;
}

// ============================================================================
// Legacy Aliases (for backward compatibility)
// ============================================================================

/**
 * @deprecated Use isX402V1Payload or isLegacyV1Payload instead
 */
export function isV1(obj: unknown): boolean {
  return isX402V1Payload(obj) || isLegacyV1Payload(obj);
}

/**
 * @deprecated Use isX402V2Payload or isLegacyV2Payload instead
 */
export function isV2(obj: unknown): boolean {
  return isX402V2Payload(obj) || isLegacyV2Payload(obj);
}
