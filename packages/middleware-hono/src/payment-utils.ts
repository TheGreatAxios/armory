import type {
  X402PaymentPayload,
  X402PaymentRequirements,
} from "@armory-sh/base";
import { decodePayment, isPaymentPayload, isExactEvmPayload } from "@armory-sh/base";

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

// Union type for V2 payload formats
export type AnyPaymentPayload = X402PaymentPayload | LegacyPaymentPayloadV2;

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

  // Try JSON first (for test compatibility)
  if (headerValue.startsWith("{")) {
    try {
      payload = JSON.parse(headerValue);
    } catch {
      throw new Error("Invalid payment payload: not valid JSON");
    }
  } else {
    // Use core's decodePayment for proper Base64URL handling
    try {
      payload = decodePayment(headerValue);
    } catch {
      throw new Error("Invalid payment payload: not valid Base64");
    }
  }

  // Check for x402 V2 format
  if (isPaymentPayload(payload)) {
    return { payload };
  }

  if (isLegacyV2(payload)) {
    return { payload };
  }

  throw new Error("Unrecognized payment payload format");
};

export const extractPayerAddress = (payload: AnyPaymentPayload): string => {
  if (isPaymentPayload(payload) && isExactEvmPayload(payload.payload)) {
    return payload.payload.authorization.from;
  }

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
