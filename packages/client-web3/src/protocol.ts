/**
 * X402 Protocol Detection and Parsing Functions
 *
 * Handles both x402 V1 and V2 protocol detection and parsing from HTTP responses.
 */

import {
  V1_HEADERS,
  V2_HEADERS,
  decodeX402PaymentRequiredV1,
  isX402V1PaymentRequired,
  isX402V2PaymentRequired,
  type PaymentRequirementsV1,
  type PaymentRequirementsV2,
  type PaymentRequiredV2,
  type X402PaymentRequiredV1,
  type X402PaymentPayloadV1,
  type PaymentPayloadV2,
  type EIP3009Authorization,
  type EIP3009AuthorizationV1,
  getPaymentRequiredHeaderName,
  getPaymentHeaderName,
} from "@armory-sh/base";

// ============================================================================
// Types
// ============================================================================

export type X402Version = 1 | 2;

export interface ParsedPaymentRequired {
  version: X402Version;
  requirements: PaymentRequirementsV1[] | PaymentRequirementsV2[];
  raw: X402PaymentRequiredV1 | PaymentRequiredV2;
}

// ============================================================================
// Version Detection
// ============================================================================

/**
 * Detect x402 protocol version from response headers
 * Returns V2 if PAYMENT-REQUIRED header exists, V1 for X-PAYMENT-REQUIRED
 * Falls back to body detection if no headers present
 */
export const detectX402Version = (response: Response, fallbackVersion: X402Version = 2): X402Version => {
  // V2 uses PAYMENT-REQUIRED header
  if (response.headers.has(V2_HEADERS.PAYMENT_REQUIRED)) {
    return 2;
  }

  // V1 uses X-PAYMENT-REQUIRED header
  if (response.headers.has(V1_HEADERS.PAYMENT_REQUIRED)) {
    return 1;
  }

  // Also check for alternate case variations
  if (response.headers.has("Payment-Required")) {
    return 2;
  }

  return fallbackVersion;
};

/**
 * Detect version from a parsed payment required object
 */
export const detectVersionFromObject = (obj: unknown): X402Version | null => {
  if (isX402V2PaymentRequired(obj)) return 2;
  if (isX402V1PaymentRequired(obj)) return 1;
  return null;
};

// ============================================================================
// Payment Required Parsing
// ============================================================================

/**
 * Parse PAYMENT-REQUIRED header or response body
 * Handles both V1 (base64 encoded) and V2 (JSON) formats
 */
export const parsePaymentRequired = async (
  response: Response,
  version?: X402Version
): Promise<ParsedPaymentRequired> => {
  const detectedVersion = version ?? detectX402Version(response);

  // Try header-based parsing first
  const headerName = getPaymentRequiredHeaderName(detectedVersion);
  const header = response.headers.get(headerName);

  if (header) {
    return parsePaymentRequiredFromHeader(header, detectedVersion);
  }

  // Fall back to body parsing
  const body = await response.clone().text();
  return parsePaymentRequiredFromBody(body, detectedVersion);
};

/**
 * Parse payment required from header value
 */
export const parsePaymentRequiredFromHeader = (
  header: string,
  version: X402Version
): ParsedPaymentRequired => {
  if (version === 1) {
    // V1: Base64 encoded JSON
    const decoded = decodeX402PaymentRequiredV1(header);
    return {
      version: 1,
      requirements: decoded.accepts,
      raw: decoded,
    };
  }

  // V2: JSON directly (or base64 encoded JSON)
  let parsed: PaymentRequiredV2;
  try {
    // Try plain JSON first
    parsed = JSON.parse(header) as PaymentRequiredV2;
  } catch {
    // Fall back to base64 decode
    const decoded = Buffer.from(header, "base64").toString("utf-8");
    parsed = JSON.parse(decoded) as PaymentRequiredV2;
  }

  return {
    version: 2,
    requirements: parsed.accepts,
    raw: parsed,
  };
};

/**
 * Parse payment required from response body
 */
export const parsePaymentRequiredFromBody = (
  body: string,
  version: X402Version
): ParsedPaymentRequired => {
  let parsed: unknown;

  // Try JSON parse
  try {
    parsed = JSON.parse(body);
  } catch {
    // Try base64 decode then JSON
    const decoded = Buffer.from(body, "base64").toString("utf-8");
    parsed = JSON.parse(decoded);
  }

  // Detect version from object if not specified
  const detectedVersion = detectVersionFromObject(parsed) ?? version;

  if (detectedVersion === 1 && isX402V1PaymentRequired(parsed)) {
    return {
      version: 1,
      requirements: parsed.accepts,
      raw: parsed,
    };
  }

  if (detectedVersion === 2 && isX402V2PaymentRequired(parsed)) {
    const v2Parsed = parsed as PaymentRequiredV2;
    return {
      version: 2,
      requirements: v2Parsed.accepts,
      raw: v2Parsed,
    };
  }

  throw new Error("Unable to parse payment required response");
};

// ============================================================================
// Payment Payload Creation
// ============================================================================

/**
 * Create x402 V1 payment payload
 */
export const createX402V1Payment = (params: {
  from: string;
  to: string;
  value: string;
  nonce: `0x${string}`;
  validAfter: string;
  validBefore: string;
  signature: `0x${string}`;
  network: string;
}): X402PaymentPayloadV1 => {
  const authorization: EIP3009AuthorizationV1 = {
    from: params.from as `0x${string}`,
    to: params.to as `0x${string}`,
    value: params.value,
    validAfter: params.validAfter,
    validBefore: params.validBefore,
    nonce: params.nonce,
  };

  return {
    x402Version: 1,
    scheme: "exact",
    network: params.network,
    payload: {
      signature: params.signature,
      authorization,
    },
  };
};

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
  accepted: PaymentRequirementsV2;
  resource?: { url: string; description?: string; mimeType?: string };
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
    resource: params.resource,
    payload: {
      signature: params.signature,
      authorization,
    },
  };
};

// ============================================================================
// Header Creation
// ============================================================================

/**
 * Create payment header for request
 */
export const createPaymentHeader = (
  payload: X402PaymentPayloadV1 | PaymentPayloadV2,
  version: X402Version
): string => {
  const headerName = getPaymentHeaderName(version);
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64");
  return encoded;
};

/**
 * Get the payment header name for a version
 */
export const getPaymentHeader = (version: X402Version): string => {
  return getPaymentHeaderName(version);
};

/**
 * Get the payment required header name for a version
 */
export const getPaymentRequiredHeader = (version: X402Version): string => {
  return getPaymentRequiredHeaderName(version);
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
  return (
    response.headers.has(V1_HEADERS.PAYMENT_REQUIRED) ||
    response.headers.has(V2_HEADERS.PAYMENT_REQUIRED) ||
    response.headers.has("Payment-Required")
  );
};

/**
 * Extract requirements for a specific scheme from accepts array
 * Uses type assertion to handle union types
 */
export const selectSchemeRequirements = (
  requirements: PaymentRequirementsV1[] | PaymentRequirementsV2[],
  scheme: string = "exact"
): PaymentRequirementsV1 | PaymentRequirementsV2 | undefined => {
  // Cast to handle the union type - all items in the array should have the same type
  return (requirements as Array<PaymentRequirementsV1 | PaymentRequirementsV2>).find(
    (r) => "scheme" in r && r.scheme === scheme
  );
};
