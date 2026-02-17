/**
 * X402 Protocol Encoding - V2 Only (Coinbase Compatible)
 *
 * Payment payloads are JSON-encoded for transport in HTTP headers.
 * Matches the Coinbase x402 v2 SDK format.
 */

import { V2_HEADERS } from "../types/v2";
import type {
  PaymentPayload,
  PaymentRequirements,
  SettlementResponse,
  X402Response,
} from "../types/x402";
import { isPaymentPayload } from "../types/x402";
import {
  decodeBase64ToUtf8,
  encodeUtf8ToBase64,
  normalizeBase64Url,
  toBase64Url,
} from "../utils/base64";

/**
 * Safe Base64 encode (URL-safe, no padding)
 */
export function safeBase64Encode(str: string): string {
  return toBase64Url(encodeUtf8ToBase64(str));
}

/**
 * Safe Base64 decode (handles URL-safe format)
 */
export function safeBase64Decode(str: string): string {
  return decodeBase64ToUtf8(normalizeBase64Url(str));
}

/**
 * Encode payment payload to JSON string
 */
export function encodePayment(payload: PaymentPayload): string {
  if (!isPaymentPayload(payload)) {
    throw new Error("Invalid payment payload format");
  }
  // Convert any bigint values to strings for JSON serialization
  const safePayload = JSON.parse(
    JSON.stringify(payload, (_, value) => {
      if (typeof value === "bigint") {
        return value.toString();
      }
      return value;
    }),
  );

  return safeBase64Encode(JSON.stringify(safePayload));
}

/**
 * Decode payment payload from JSON string
 */
export function decodePayment(encoded: string): PaymentPayload {
  let parsed: unknown;
  try {
    parsed = JSON.parse(encoded);
  } catch {
    const decoded = safeBase64Decode(encoded);
    parsed = JSON.parse(decoded);
  }

  if (!isPaymentPayload(parsed)) {
    throw new Error("Invalid payment payload format");
  }

  return parsed;
}

/**
 * Encode settlement response to JSON string
 */
export function encodeSettlementResponse(response: SettlementResponse): string {
  const safeResponse = JSON.parse(
    JSON.stringify(response, (_, value) => {
      if (typeof value === "bigint") {
        return value.toString();
      }
      return value;
    }),
  );

  return safeBase64Encode(JSON.stringify(safeResponse));
}

/**
 * Decode settlement response from JSON string
 */
export function decodeSettlementResponse(encoded: string): SettlementResponse {
  try {
    return JSON.parse(encoded);
  } catch {
    const decoded = safeBase64Decode(encoded);
    return JSON.parse(decoded);
  }
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
  try {
    return JSON.parse(encoded);
  } catch {
    const decoded = safeBase64Decode(encoded);
    return JSON.parse(decoded);
  }
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
export function extractPaymentFromHeaders(
  headers: Headers,
): PaymentPayload | null {
  const encoded = headers.get("PAYMENT-SIGNATURE");
  if (!encoded) return null;

  try {
    return decodePayment(encoded);
  } catch {
    return null;
  }
}

export interface PaymentRequiredOptions {
  error?: string;
  resource?: {
    url: string;
    description?: string;
    mimeType?: string;
  };
  extensions?: Record<string, unknown>;
}

/**
 * Create payment required headers (V2 format)
 */
export function createPaymentRequiredHeaders(
  requirements: PaymentRequirements | PaymentRequirements[],
  options?: PaymentRequiredOptions,
): Record<string, string> {
  const accepts = Array.isArray(requirements) ? requirements : [requirements];

  const response = {
    x402Version: 2,
    error: options?.error ?? "Payment required",
    resource: options?.resource ?? { url: "", mimeType: "application/json" },
    accepts,
    extensions: options?.extensions ?? {},
  };

  return {
    [V2_HEADERS.PAYMENT_REQUIRED]: safeBase64Encode(JSON.stringify(response)),
  };
}

/**
 * Create settlement response headers (V2 format)
 */
export function createSettlementHeaders(
  settlement: SettlementResponse,
): Record<string, string> {
  return {
    [V2_HEADERS.PAYMENT_RESPONSE]: encodeSettlementResponse(settlement),
  };
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
