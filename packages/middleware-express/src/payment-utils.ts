import type {
  X402PaymentPayload,
  X402PaymentRequirements,
  SettlementResponse,
} from "@armory-sh/base";
import { decodePayment, isPaymentPayload, isExactEvmPayload } from "@armory-sh/base";

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
  payment: "PAYMENT-SIGNATURE",
  required: "PAYMENT-REQUIRED",
  response: "PAYMENT-RESPONSE",
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
  let payload: unknown;

  if (headerValue.startsWith("{")) {
    try {
      payload = JSON.parse(headerValue);
    } catch {
      throw new Error("Invalid payment payload: not valid JSON");
    }
  } else {
    try {
      payload = decodePayment(headerValue);
    } catch {
      throw new Error("Invalid payment payload: not valid Base64");
    }
  }

  if (isPaymentPayload(payload)) {
    return { payload };
  }

  if (isLegacyV2(payload)) {
    return { payload };
  }

  throw new Error("Unrecognized payment payload format");
};

export const extractPayerAddress = (payload: AnyPaymentPayload): string => {
  if (isPaymentPayload(payload)) {
    const p = payload.payload;
    if (isExactEvmPayload(p) && p.authorization?.from) {
      return p.authorization.from;
    }
  }

  if ("from" in payload && typeof payload.from === "string") {
    return payload.from;
  }

  throw new Error("Unable to extract payer address from payload");
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

  if (!isPaymentPayload(payload) || !isExactEvmPayload(payload.payload)) {
    return {
      success: false,
      error: "Invalid payment payload format",
    };
  }

  return {
    success: true,
    payerAddress: payload.payload.authorization.from,
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
