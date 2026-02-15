import type {
  X402PaymentPayload,
  X402PaymentRequirements,
  SettlementResponse,
} from "@armory-sh/base";
import { extractPaymentFromHeaders, PAYMENT_SIGNATURE_HEADER } from "@armory-sh/base";

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

export type AnyPaymentPayload = X402PaymentPayload | LegacyPaymentPayloadV2;

export type PaymentPayload = AnyPaymentPayload;
export type { X402PaymentRequirements as PaymentRequirements } from "@armory-sh/base";

export interface PaymentVerificationResult {
  success: boolean;
  payload?: AnyPaymentPayload;
  payerAddress?: string;
  error?: string;
}

export interface PaymentSettlementResult extends SettlementResponse {
  error?: string;
}

export const PAYMENT_HEADERS = {
  PAYMENT: "PAYMENT-SIGNATURE",
  REQUIRED: "PAYMENT-REQUIRED",
  RESPONSE: "PAYMENT-RESPONSE",
} as const;

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

    const result = await response.json() as { success?: boolean; error?: string; payerAddress?: string };

    if (!response.ok || !result.success) {
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

export const settleWithFacilitator = async (
  facilitatorUrl: string,
  payload: AnyPaymentPayload,
  requirements: X402PaymentRequirements
): Promise<PaymentSettlementResult> => {
  try {
    const response = await fetch(`${facilitatorUrl}/settle`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ payload, requirements }),
    });

    const result = await response.json() as { success?: boolean; transaction?: string; network?: string; error?: string };

    if (!response.ok || !result.success) {
      return {
        success: false,
        transaction: result.transaction,
        network: result.network,
        error: result.error ?? "Settlement failed",
      };
    }

    return {
      success: true,
      transaction: result.transaction,
      network: result.network,
    };
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
  if (isLegacyV2(payload)) {
    return {
      success: false,
      error: "Local verification not supported for legacy payload format. Use a facilitator.",
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

export const settlePaymentWithRetry = async (
  payload: AnyPaymentPayload,
  requirements: X402PaymentRequirements,
  facilitatorUrl?: string
): Promise<PaymentSettlementResult> => {
  if (!facilitatorUrl) {
    return {
      success: false,
      error: "Facilitator URL is required for settlement",
    };
  }

  return settleWithFacilitator(facilitatorUrl, payload, requirements);
};

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
