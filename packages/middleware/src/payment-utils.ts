import type {
  PaymentPayload,
  PaymentRequirements,
} from "@armory/base";
import { decodePayment, detectPaymentVersion, isPaymentV1 } from "@armory/base";
import type { VerifyPaymentOptions } from "@armory/facilitator";
import { verifyPayment } from "@armory/facilitator";

export type PaymentVersion = 1 | 2;

export interface PaymentVerificationResult {
  success: boolean;
  payload?: PaymentPayload;
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

export const getRequirementsVersion = (requirements: PaymentRequirements): PaymentVersion =>
  "contractAddress" in requirements && "network" in requirements ? 1 : 2;

export const encodeRequirements = (requirements: PaymentRequirements): string =>
  JSON.stringify(requirements);

export const decodePayload = (
  headerValue: string
): { payload: PaymentPayload; version: PaymentVersion } => {
  const headers = new Headers();
  headers.set(headerValue.startsWith("{") ? "PAYMENT-SIGNATURE" : "X-PAYMENT", headerValue);
  const payload = decodePayment(headers);
  const version = detectPaymentVersion(headers) ?? 2;
  return { payload, version };
};

export const createVerificationError = (
  message: string,
  details?: unknown
): string => JSON.stringify({ error: message, details });

export const verifyWithFacilitator = async (
  facilitatorUrl: string,
  payload: PaymentPayload,
  requirements: PaymentRequirements,
  verifyOptions?: VerifyPaymentOptions
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
  payload: PaymentPayload,
  requirements: PaymentRequirements,
  verifyOptions?: VerifyPaymentOptions
): Promise<PaymentVerificationResult> => {
  const result = await verifyPayment(payload, requirements, verifyOptions);

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
  payload: PaymentPayload,
  requirements: PaymentRequirements,
  facilitatorUrl?: string,
  verifyOptions?: VerifyPaymentOptions
): Promise<PaymentVerificationResult> =>
  facilitatorUrl
    ? verifyWithFacilitator(facilitatorUrl, payload, requirements, verifyOptions)
    : verifyLocally(payload, requirements, verifyOptions);

export const extractPayerAddress = (payload: PaymentPayload): string =>
  isPaymentV1(payload) ? payload.from : payload.from;

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
