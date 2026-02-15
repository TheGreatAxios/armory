/**
 * X402 Protocol Encoding - V2 Only (Coinbase Compatible)
 *
 * Payment payloads are JSON-encoded for transport in HTTP headers.
 * Matches the Coinbase x402 v2 SDK format.
 */

import type {
  PaymentPayload,
  X402Response,
  PaymentPayloadV2,
  PaymentRequirements,
  SettlementResponse,
} from "../types/x402";

import { isPaymentPayload, legacyToPaymentPayload } from "../types/x402";
import { V2_HEADERS } from "../types/v2";

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
 * Encode payment payload to JSON string
 */
export function encodePayment(payload: PaymentPayload | PaymentPayloadV2): string {
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
 * Decode payment payload from JSON string
 */
export function decodePayment(encoded: string): PaymentPayload {
  const decoded = safeBase64Decode(encoded);
  const parsed = JSON.parse(decoded);

  if (!isPaymentPayload(parsed)) {
    // Try to convert from legacy format
    return legacyToPaymentPayload(parsed as PaymentPayloadV2);
  }

  return parsed;
}

/**
 * Encode settlement response to JSON string
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
 * Decode settlement response from JSON string
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
 * Detect payment version from headers
 * Returns null if no payment header found
 *
 * V2-only: checks for PAYMENT-SIGNATURE header
 */
export function detectPaymentVersion(headers: Headers): number | null {
  if (headers.has("PAYMENT-SIGNATURE")) {
    return 2;
  }

  return null;
}

/**
 * Extract payment from V2 headers
 */
export function extractPaymentFromHeaders(headers: Headers): PaymentPayload | null {
  const encoded = headers.get("PAYMENT-SIGNATURE");
  if (!encoded) return null;

  try {
    return decodePayment(encoded);
  } catch {
    return null;
  }
}

/**
 * Create payment required headers (V2 format)
 */
export function createPaymentRequiredHeaders(
  requirements: PaymentRequirements | PaymentRequirements[]
): Record<string, string> {
  const accepts = Array.isArray(requirements) ? requirements : [requirements];

  const response = {
    x402Version: 2,
    accepts,
  };

  return {
    [V2_HEADERS.PAYMENT_REQUIRED]: safeBase64Encode(JSON.stringify(response)),
  };
}

/**
 * Create settlement response headers (V2 format)
 */
export function createSettlementHeaders(
  settlement: SettlementResponse
): Record<string, string> {
  return {
    [V2_HEADERS.PAYMENT_RESPONSE]: encodeSettlementResponse(settlement),
  };
}

/**
 * Type guard for legacy V2 payload (without x402Version)
 */
export function isLegacyV2(payload: unknown): payload is PaymentPayloadV2 {
  return (
    typeof payload === "object" &&
    payload !== null &&
    "signature" in payload &&
    typeof (payload as PaymentPayloadV2).signature === "object"
  );
}

/**
 * Decode settlement from headers (V2 only)
 */
export function decodeSettlement(headers: Headers): SettlementResponse {
  const encoded = headers.get(V2_HEADERS.PAYMENT_RESPONSE);
  if (!encoded) {
    throw new Error(`No ${V2_HEADERS.PAYMENT_RESPONSE} header found`);
  }
  return decodeSettlementResponse(encoded);
}
