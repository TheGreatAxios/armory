import type {
  X402PaymentPayload,
  X402PaymentRequirements,
  PaymentRequirements,
} from "@armory-sh/base";
import { extractPaymentFromHeaders, X402_HEADERS } from "@armory-sh/base";
import type { X402VerifyOptions } from "@armory-sh/facilitator";
import { verifyX402Payment as verifyPayment } from "@armory-sh/facilitator";

// Legacy V1 payload type for backward compatibility
export interface LegacyPaymentPayloadV1 {
  amount: string;
  network: string;
  contractAddress: string;
  payTo: string;
  from: string;
  expiry: number;
  signature: string; // 0x-prefixed hex signature
}

// Legacy V2 payload type for backward compatibility
export interface LegacyPaymentPayloadV2 {
  to: string;
  from: string;
  amount: string;
  chainId: string;
  assetId: string;
  nonce: string;
  expiry: number;
  signature: string; // 0x-prefixed hex signature
}

// Union type for all payload formats
export type AnyPaymentPayload = X402PaymentPayload | LegacyPaymentPayloadV1 | LegacyPaymentPayloadV2;

// Re-export types for use in index.ts
// Use union type to support all payload formats
export type PaymentPayload = AnyPaymentPayload;
export type { X402PaymentRequirements as PaymentRequirements } from "@armory-sh/base";

export type PaymentVersion = 1 | 2;

export interface PaymentVerificationResult {
  success: boolean;
  payload?: AnyPaymentPayload;
  version?: PaymentVersion;
  payerAddress?: string;
  error?: string;
}

export interface PaymentHeaders {
  payment: string;
  required: string;
  response: string;
}

export const getHeadersForVersion = (version: PaymentVersion): PaymentHeaders =>
  version === 1
    ? { payment: "X-PAYMENT", required: "X-PAYMENT-REQUIRED", response: "X-PAYMENT-RESPONSE" }
    : { payment: "PAYMENT-SIGNATURE", required: "PAYMENT-REQUIRED", response: "PAYMENT-RESPONSE" };

export const getRequirementsVersion = (requirements: X402PaymentRequirements): PaymentVersion =>
  "contractAddress" in requirements && "network" in requirements ? 1 : 2;

export const encodeRequirements = (requirements: X402PaymentRequirements): string =>
  JSON.stringify(requirements);

/**
 * Detect if a payload is legacy V1 format
 */
function isLegacyV1(payload: unknown): payload is LegacyPaymentPayloadV1 {
  return (
    typeof payload === "object" &&
    payload !== null &&
    "contractAddress" in payload &&
    "network" in payload &&
    "signature" in payload &&
    typeof (payload as LegacyPaymentPayloadV1).signature === "string"
  );
}

/**
 * Detect if a payload is legacy V2 format
 */
function isLegacyV2(payload: unknown): payload is LegacyPaymentPayloadV2 {
  return (
    typeof payload === "object" &&
    payload !== null &&
    "chainId" in payload &&
    "assetId" in payload &&
    "signature" in payload &&
    typeof (payload as LegacyPaymentPayloadV2).signature === "string"
  );
}

export const decodePayload = (
  headerValue: string
): { payload: AnyPaymentPayload; version: PaymentVersion } => {
  // Try to parse as JSON first
  let parsed: unknown;
  try {
    if (headerValue.startsWith("{")) {
      parsed = JSON.parse(headerValue);
    } else {
      parsed = JSON.parse(atob(headerValue));
    }
  } catch {
    throw new Error("Invalid payment payload");
  }

  // Check for x402 format first
  const headers = new Headers();
  headers.set(X402_HEADERS.PAYMENT, headerValue);
  const x402Payload = extractPaymentFromHeaders(headers);
  if (x402Payload) {
    return { payload: x402Payload, version: 2 };
  }

  // Check for legacy formats
  if (isLegacyV1(parsed)) {
    return { payload: parsed, version: 1 };
  }

  if (isLegacyV2(parsed)) {
    return { payload: parsed, version: 2 };
  }

  throw new Error("Unrecognized payment payload format");
};

export const createVerificationError = (
  message: string,
  details?: unknown
): string => JSON.stringify({ error: message, details });

export const verifyWithFacilitator = async (
  facilitatorUrl: string,
  payload: AnyPaymentPayload,
  requirements: X402PaymentRequirements,
  verifyOptions?: X402VerifyOptions
): Promise<PaymentVerificationResult> => {
  try {
    const response = await fetch(`${facilitatorUrl}/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ payload, requirements, options: verifyOptions }),
    });

    if (!response.ok) {
      const error = await response.json();
      return { success: false, error: JSON.stringify(error) };
    }

    const result = await response.json() as { success: boolean; error?: string; payerAddress?: string };
    if (!result.success) {
      return { success: false, error: result.error ?? "Verification failed" };
    }

    return { success: true, payerAddress: result.payerAddress ?? "" };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown facilitator error",
    };
  }
};

export const verifyLocally = async (
  payload: AnyPaymentPayload,
  requirements: X402PaymentRequirements,
  verifyOptions?: X402VerifyOptions
): Promise<PaymentVerificationResult> => {
  // For legacy formats, we'd need to convert to x402 format first
  // For now, return an error indicating facilitator is required for legacy formats
  if (isLegacyV1(payload) || isLegacyV2(payload)) {
    return {
      success: false,
      error: "Local verification not supported for legacy payload formats. Use a facilitator.",
    };
  }

  const result = await verifyPayment(payload as X402PaymentPayload, requirements, verifyOptions);

  if (!result.success) {
    return {
      success: false,
      error: JSON.stringify({
        error: "Payment verification failed",
        reason: result.error.name,
        message: result.error.message,
      }),
    };
  }

  return { success: true, payerAddress: result.payerAddress };
};

export const verifyPaymentWithRetry = async (
  payload: AnyPaymentPayload,
  requirements: X402PaymentRequirements,
  facilitatorUrl?: string,
  verifyOptions?: X402VerifyOptions
): Promise<PaymentVerificationResult> =>
  facilitatorUrl
    ? verifyWithFacilitator(facilitatorUrl, payload, requirements, verifyOptions)
    : verifyLocally(payload, requirements, verifyOptions);

/**
 * Extract payer address from various payload formats
 */
export const extractPayerAddress = (payload: AnyPaymentPayload): string => {
  // x402 format
  if ("payload" in payload) {
    const x402Payload = payload as X402PaymentPayload;
    if ("authorization" in x402Payload.payload) {
      return x402Payload.payload.authorization.from;
    }
  }

  // Legacy V1/V2 format
  if ("from" in payload && typeof payload.from === "string") {
    return payload.from;
  }

  throw new Error("Unable to extract payer address from payload");
};

export const createResponseHeaders = (
  payerAddress: string,
  version: PaymentVersion
): Record<string, string> => ({
  [getHeadersForVersion(version).response]: JSON.stringify({
    status: "verified",
    payerAddress,
    version,
  }),
});
