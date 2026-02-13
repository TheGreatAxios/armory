/**
 * X402 Protocol Encoding - Coinbase Compatible
 * 
 * All payment payloads are Base64 encoded for transport in HTTP headers.
 * This matches the Coinbase x402 SDK format.
 */

import type {
  PaymentPayload,
  SettlementResponse,
  X402Response,
  LegacyPaymentPayload,
  PaymentPayloadV1,
  PaymentPayloadV2,
  PaymentRequirements,
} from "../types/x402";

import { isPaymentPayload, legacyToPaymentPayload } from "../types/x402";

/**
 * Safe Base64 encode (URL-safe, no padding)
 */
export function safeBase64Encode(str: string): string {
  return Buffer.from(str)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

/**
 * Safe Base64 decode (handles URL-safe format)
 */
export function safeBase64Decode(str: string): string {
  // Restore padding
  const padding = 4 - (str.length % 4);
  if (padding !== 4) {
    str += "=".repeat(padding);
  }
  // Restore standard Base64 characters
  str = str.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(str, "base64").toString("utf-8");
}

/**
 * Encode payment payload to Base64 string
 * All versions use Base64 encoding for compatibility
 */
export function encodePayment(payload: PaymentPayload | LegacyPaymentPayload): string {
  let normalizedPayload: PaymentPayload;

  if (isPaymentPayload(payload)) {
    normalizedPayload = payload;
  } else {
    normalizedPayload = legacyToPaymentPayload(payload);
  }

  // Convert any bigint values to strings for JSON serialization
  const safePayload = JSON.parse(JSON.stringify(normalizedPayload, (_, value) => {
    if (typeof value === "bigint") {
      return value.toString();
    }
    return value;
  }));

  return safeBase64Encode(JSON.stringify(safePayload));
}

/**
 * Decode payment payload from Base64 string
 */
export function decodePayment(encoded: string): PaymentPayload {
  const decoded = safeBase64Decode(encoded);
  const parsed = JSON.parse(decoded);

  if (!isPaymentPayload(parsed)) {
    // Try to convert from legacy format
    return legacyToPaymentPayload(parsed as LegacyPaymentPayload);
  }

  return parsed;
}

/**
 * Encode settlement response to Base64 string
 */
export function encodeSettlementResponse(response: SettlementResponse): string {
  const safeResponse = JSON.parse(JSON.stringify(response, (_, value) => {
    if (typeof value === "bigint") {
      return value.toString();
    }
    return value;
  }));

  return safeBase64Encode(JSON.stringify(safeResponse));
}

/**
 * Decode settlement response from Base64 string
 */
export function decodeSettlementResponse(encoded: string): SettlementResponse {
  const decoded = safeBase64Decode(encoded);
  return JSON.parse(decoded);
}

/**
 * Encode X402 error response
 */
export function encodeX402Response(response: X402Response): string {
  return safeBase64Encode(JSON.stringify(response));
}

/**
 * Decode X402 error response
 */
export function decodeX402Response(encoded: string): X402Response {
  const decoded = safeBase64Decode(encoded);
  return JSON.parse(decoded);
}

/**
 * Unified X402 headers - Coinbase compatible
 */
export const X402_HEADERS = {
  PAYMENT: "X-PAYMENT",
  PAYMENT_RESPONSE: "X-PAYMENT-RESPONSE",
  PAYMENT_REQUIRED: "X-PAYMENT-REQUIRED",
} as const;

/**
 * Detect payment version from headers
 * Returns null if no payment header found
 *
 * Supports both x402 format (X-PAYMENT header with x402Version)
 * and legacy format (X-PAYMENT for v1, PAYMENT-SIGNATURE for v2)
 */
export function detectPaymentVersion(headers: Headers): number | null {
  // Check for legacy V2 PAYMENT-SIGNATURE header first
  if (headers.has("PAYMENT-SIGNATURE")) {
    return 2;
  }

  // Check X-PAYMENT header (used by both v1 legacy and x402)
  if (headers.has(X402_HEADERS.PAYMENT)) {
    const encoded = headers.get(X402_HEADERS.PAYMENT);
    if (encoded) {
      try {
        const decoded = decodePayment(encoded);
        // x402 format has x402Version property
        if (isPaymentPayload(decoded) && "x402Version" in decoded) {
          return decoded.x402Version;
        }
        // Legacy V1 format - detect by structure
        return 1;
      } catch {
        // If decoding fails, assume V1 legacy (base64 encoded JSON)
        return 1;
      }
    }
    // Has X-PAYMENT header but no value, assume V1
    return 1;
  }

  return null;
}

/**
 * Extract payment from headers
 */
export function extractPaymentFromHeaders(headers: Headers): PaymentPayload | null {
  const encoded = headers.get(X402_HEADERS.PAYMENT);
  if (!encoded) return null;

  try {
    return decodePayment(encoded);
  } catch {
    return null;
  }
}

/**
 * Create payment required headers
 */
export function createPaymentRequiredHeaders(
  requirements: PaymentRequirements | PaymentRequirements[]
): Record<string, string> {
  const accepts = Array.isArray(requirements) ? requirements : [requirements];
  
  const response = {
    x402Version: 1,
    accepts,
  };

  return {
    [X402_HEADERS.PAYMENT_REQUIRED]: safeBase64Encode(JSON.stringify(response)),
  };
}

/**
 * Create settlement response headers
 */
export function createSettlementHeaders(
  settlement: SettlementResponse
): Record<string, string> {
  return {
    [X402_HEADERS.PAYMENT_RESPONSE]: encodeSettlementResponse(settlement),
  };
}

/**
 * Type guards for legacy compatibility
 */
export function isLegacyV1(payload: unknown): payload is PaymentPayloadV1 {
  return (
    typeof payload === "object" &&
    payload !== null &&
    "v" in payload &&
    typeof (payload as PaymentPayloadV1).v === "number"
  );
}

export function isLegacyV2(payload: unknown): payload is PaymentPayloadV2 {
  return (
    typeof payload === "object" &&
    payload !== null &&
    "signature" in payload &&
    typeof (payload as PaymentPayloadV2).signature === "object"
  );
}

/**
 * Decode settlement from headers (legacy compatibility)
 */
export function decodeSettlement(headers: Headers): SettlementResponse {
  const encoded = headers.get(X402_HEADERS.PAYMENT_RESPONSE);
  if (!encoded) {
    throw new Error(`No ${X402_HEADERS.PAYMENT_RESPONSE} header found`);
  }
  return decodeSettlementResponse(encoded);
}
