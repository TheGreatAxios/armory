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
  "maxAmountRequired" in requirements ? 1 : 2;

export const encodeRequirements = (requirements: X402PaymentRequirements): string =>
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

  // Check for x402Version to detect version first
  if (typeof parsed === "object" && parsed !== null && "x402Version" in parsed) {
    const version = (parsed as { x402Version: number }).x402Version;
    if (version === 1) {
      return { payload: parsed as AnyPaymentPayload, version: 1 };
    }
    if (version === 2) {
      return { payload: parsed as AnyPaymentPayload, version: 2 };
    }
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
