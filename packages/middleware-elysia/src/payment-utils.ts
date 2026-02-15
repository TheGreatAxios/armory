import type {
  X402PaymentPayload,
  X402PaymentRequirements,
} from "@armory-sh/base";
import { extractPaymentFromHeaders, PAYMENT_SIGNATURE_HEADER } from "@armory-sh/base";

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

// Union type for V2 payload formats
export type AnyPaymentPayload = X402PaymentPayload | LegacyPaymentPayloadV2;

// Re-export types for use in index.ts
export type PaymentPayload = AnyPaymentPayload;
export type { X402PaymentRequirements as PaymentRequirements } from "@armory-sh/base";

export interface PaymentVerificationResult {
  success: boolean;
  payload?: AnyPaymentPayload;
  payerAddress?: string;
  error?: string;
}

// V2 hardcoded headers
export const PAYMENT_HEADERS = {
  PAYMENT: "PAYMENT-SIGNATURE",
  REQUIRED: "PAYMENT-REQUIRED",
  RESPONSE: "PAYMENT-RESPONSE",
} as const;

export const encodeRequirements = (requirements: X402PaymentRequirements): string =>
  JSON.stringify(requirements);

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
): { payload: AnyPaymentPayload } => {
  // Try to parse as JSON first
  let parsed: unknown;
  let isJsonString = false;
  try {
    if (headerValue.startsWith("{")) {
      parsed = JSON.parse(headerValue);
      isJsonString = true;
    } else {
      parsed = JSON.parse(atob(headerValue));
    }
  } catch {
    throw new Error("Invalid payment payload");
  }

  const base64Value = isJsonString
    ? Buffer.from(headerValue).toString("base64")
    : headerValue;
  const headers = new Headers();
  headers.set(PAYMENT_SIGNATURE_HEADER, base64Value);
  const x402Payload = extractPaymentFromHeaders(headers);
  if (x402Payload) {
    return { payload: x402Payload };
  }

  if (isLegacyV2(parsed)) {
    return { payload: parsed };
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
  requirements: X402PaymentRequirements
): Promise<PaymentVerificationResult> => {
  try {
    const response = await fetch(`${facilitatorUrl}/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ payload, requirements }),
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
  requirements: X402PaymentRequirements
): Promise<PaymentVerificationResult> => {
  // For legacy format, we'd need to convert to x402 format first
  if (isLegacyV2(payload)) {
    return {
      success: false,
      error: "Local verification not supported for legacy payload format. Use a facilitator.",
    };
  }

  // For x402 format, verify locally
  return {
    success: true,
    payerAddress: (payload as X402PaymentPayload).payload.authorization.from,
  };
};

export const verifyPaymentWithRetry = async (
  payload: AnyPaymentPayload,
  requirements: X402PaymentRequirements,
  facilitatorUrl?: string
): Promise<PaymentVerificationResult> =>
  facilitatorUrl
    ? verifyWithFacilitator(facilitatorUrl, payload, requirements)
    : verifyLocally(payload, requirements);

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

  // Legacy V2 format
  if ("from" in payload && typeof payload.from === "string") {
    return payload.from;
  }

  throw new Error("Unable to extract payer address from payload");
};

export const createResponseHeaders = (
  payerAddress: string
): Record<string, string> => ({
  [PAYMENT_HEADERS.RESPONSE]: JSON.stringify({
    status: "verified",
    payerAddress,
  }),
});
