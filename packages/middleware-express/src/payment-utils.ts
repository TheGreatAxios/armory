import type {
  X402PaymentPayload,
  X402PaymentRequirements,
} from "@armory-sh/base";
import { extractPaymentFromHeaders, X402_HEADERS } from "@armory-sh/base";

// Legacy V1 payload type for backward compatibility
export interface LegacyPaymentPayloadV1 {
  amount: string;
  network: string;
  contractAddress: string;
  payTo: string;
  from: string;
  expiry: number;
  signature: string;
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
  signature: string;
}

// Union type for all payload formats
export type AnyPaymentPayload = X402PaymentPayload | LegacyPaymentPayloadV1 | LegacyPaymentPayloadV2;

// Re-export types for use in index.ts
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

export const encodeRequirements = (requirements: X402PaymentRequirements, _resourceUrl?: string): string =>
  JSON.stringify(requirements);

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
  headers.set(X402_HEADERS.PAYMENT, base64Value);
  const x402Payload = extractPaymentFromHeaders(headers);
  if (x402Payload) {
    return { payload: x402Payload, version: 2 };
  }

  if (isLegacyV1(parsed)) {
    return { payload: parsed, version: 1 };
  }

  if (isLegacyV2(parsed)) {
    return { payload: parsed, version: 2 };
  }

  throw new Error("Unrecognized payment payload format");
};

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
  if (isLegacyV1(payload) || isLegacyV2(payload)) {
    return {
      success: false,
      error: "Local verification not supported for legacy payload formats. Use a facilitator.",
    };
  }

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

export const extractPayerAddress = (payload: AnyPaymentPayload): string => {
  if ("payload" in payload) {
    const x402Payload = payload as X402PaymentPayload;
    if ("authorization" in x402Payload.payload) {
      return x402Payload.payload.authorization.from;
    }
  }

  if ("from" in payload && typeof payload.from === "string") {
    return payload.from;
  }

  throw new Error("Unable to extract payer address from payload");
};
