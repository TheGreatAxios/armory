/**
 * X402 Protocol Detection and Parsing Functions (V2 Only)
 *
 * Handles x402 V2 protocol detection and parsing from HTTP responses.
 */

import {
  V2_HEADERS,
  isX402V2PaymentRequired,
  type PaymentRequirementsV2,
  type PaymentRequiredV2,
  type X402PaymentPayloadV2,
  type PaymentPayloadV2,
  type EIP3009Authorization,
} from "@armory-sh/base";

// ============================================================================
// Types
// ============================================================================

export type X402Version = 2;

export interface ParsedPaymentRequired {
  version: X402Version;
  requirements: PaymentRequirementsV2[];
  raw: PaymentRequiredV2;
}

// ============================================================================
// Version Detection
// ============================================================================

/**
 * Detect x402 protocol version from response headers
 * Always returns V2 since we're v2-only
 */
export const detectX402Version = (_response: Response, _fallbackVersion: X402Version = 2): X402Version => {
  return 2;
};

/**
 * Detect version from a parsed payment required object
 */
export const detectVersionFromObject = (obj: unknown): X402Version | null => {
  if (isX402V2PaymentRequired(obj)) return 2;
  return null;
};

// ============================================================================
// Payment Required Parsing
// ============================================================================

/**
 * Parse PAYMENT-REQUIRED header or response body
 * V2 only: JSON format with x402Version: 2
 */
export const parsePaymentRequired = async (
  response: Response,
  _version?: X402Version
): Promise<ParsedPaymentRequired> => {
  const v2Header = response.headers.get(V2_HEADERS.PAYMENT_REQUIRED);
  if (!v2Header) {
    throw new Error("No PAYMENT-REQUIRED header found in V2 response");
  }

  try {
    // V2 header is JSON (may be base64-encoded)
    let parsed: PaymentRequiredV2;
    try {
      parsed = JSON.parse(v2Header) as PaymentRequiredV2;
    } catch {
      const normalized = v2Header
        .replace(/-/g, "+")
        .replace(/_/g, "/")
        .padEnd(Math.ceil(v2Header.length / 4) * 4, "=");
      const decoded = Buffer.from(normalized, "base64").toString("utf-8");
      parsed = JSON.parse(decoded) as PaymentRequiredV2;
    }

    if (!isX402V2PaymentRequired(parsed)) {
      throw new Error("Invalid x402 V2 payment required format");
    }
    if (!parsed.accepts || parsed.accepts.length === 0) {
      throw new Error("No payment requirements found in accepts array");
    }

    return {
      version: 2,
      requirements: parsed.accepts,
      raw: parsed,
    };
  } catch (error) {
    if (error instanceof Error) throw error;
    throw new Error(`Failed to parse V2 PAYMENT-REQUIRED header: ${error}`);
  }
};

// ============================================================================
// Payment Payload Creation
// ============================================================================

/**
 * Create x402 V2 payment payload
 */
export const createX402V2Payment = (params: {
  from: string;
  to: string;
  value: string;
  nonce: `0x${string}`;
  validAfter: string;
  validBefore: string;
  signature: `0x${string}`;
  network: string;
  accepted: PaymentRequirementsV2;
  resource?: { url: string; description?: string };
}): PaymentPayloadV2 => {
  const authorization: EIP3009Authorization = {
    from: params.from as `0x${string}`,
    to: params.to as `0x${string}`,
    value: params.value,
    validAfter: params.validAfter,
    validBefore: params.validBefore,
    nonce: params.nonce,
  };

  return {
    x402Version: 2,
    scheme: params.accepted.scheme,
    network: params.accepted.network,
    payload: {
      signature: params.signature,
      authorization,
    },
    resource: params.resource,
  };
};

// ============================================================================
// Header Creation
// ============================================================================

/**
 * Create payment header for request
 */
export const createPaymentHeader = (
  payload: PaymentPayloadV2,
  _version: X402Version = 2
): string => {
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64");
  return encoded;
};

/**
 * Get payment header name (V2 hardcoded)
 */
export const getPaymentHeader = (_version: X402Version = 2): string => {
  return V2_HEADERS.PAYMENT_SIGNATURE;
};

/**
 * Get payment required header name (V2 hardcoded)
 */
export const getPaymentRequiredHeader = (_version: X402Version = 2): string => {
  return V2_HEADERS.PAYMENT_REQUIRED;
};

// ============================================================================
// Validation Helpers
// ============================================================================

/**
 * Check if response indicates payment is required
 */
export const isPaymentRequiredResponse = (response: Response): boolean => {
  if (response.status === 402) return true;

  // Also check for payment-related headers
  return response.headers.has(V2_HEADERS.PAYMENT_REQUIRED);
};
