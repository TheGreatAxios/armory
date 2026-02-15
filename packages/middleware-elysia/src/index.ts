import type { Context } from "elysia";
import { Elysia } from "elysia";
import type {
  PaymentPayload,
  PaymentRequirements,
} from "./payment-utils";
import {
  getRequirementsVersion,
  getHeadersForVersion,
  encodeRequirements,
  decodePayload,
  verifyPaymentWithRetry,
  extractPayerAddress,
  createResponseHeaders,
} from "./payment-utils";

export interface PaymentMiddlewareConfig {
  requirements: PaymentRequirements;
  facilitatorUrl?: string;
  skipVerification?: boolean;
  defaultVersion?: 1 | 2;
}

export interface PaymentInfo {
  payload: PaymentPayload;
  payerAddress: string;
  version: 1 | 2;
  verified: boolean;
}

export interface PaymentContext {
  payment: PaymentInfo;
}

const errorResponse = (
  error: string | Record<string, unknown>,
  status: number,
  headers?: Record<string, string>
): Response =>
  new Response(JSON.stringify(error), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });

export const paymentMiddleware = (config: PaymentMiddlewareConfig) => {
  const { requirements, facilitatorUrl, skipVerification = false, defaultVersion } = config;
  const version = defaultVersion ?? getRequirementsVersion(requirements);
  const headers = getHeadersForVersion(version);

  return new Elysia({ name: "armory-payment" })
    .derive(() => ({
      payment: undefined as PaymentInfo | undefined,
    }))
    .onBeforeHandle(async ({ payment, request }) => {
      try {
        const paymentHeader = request.headers.get(headers.payment);

        if (!paymentHeader) {
          // For V1, use legacy base64-encoded format
          // For V2/x402, use proper PaymentRequired format
          const requiredValue = version === 1
            ? Buffer.from(JSON.stringify(requirements)).toString("base64")
            : JSON.stringify({
                x402Version: version,
                resource: {
                  url: request.url,
                  description: "API Access",
                },
                accepts: [requirements],
              });
          return errorResponse(
            { error: "Payment required", accepts: [requirements] },
            402,
            { [headers.required]: requiredValue }
          );
        }

        let payload: PaymentPayload;
        let payloadVersion: 1 | 2;
        try {
          ({ payload, version: payloadVersion } = decodePayload(paymentHeader));
        } catch (error) {
          return errorResponse({
            error: "Invalid payment payload",
            message: error instanceof Error ? error.message : "Unknown error",
          }, 400);
        }

        if (payloadVersion !== version) {
          return errorResponse({
            error: "Payment version mismatch",
            expected: version,
            received: payloadVersion,
          }, 400);
        }

        const verifyResult = skipVerification
          ? { success: true, payerAddress: extractPayerAddress(payload) }
          : await verifyPaymentWithRetry(payload, requirements, facilitatorUrl);

        if (!verifyResult.success) {
          return errorResponse(
            { error: verifyResult.error },
            402,
            { [headers.required]: encodeRequirements(requirements) }
          );
        }

        const payerAddress = verifyResult.payerAddress!;

        (payment as PaymentInfo) = { payload, payerAddress, version, verified: !skipVerification };
      } catch (error) {
        return errorResponse({
          error: "Payment middleware error",
          message: error instanceof Error ? error.message : "Unknown error",
        }, 500);
      }
    })
    .onAfterHandle(({ payment }) => {
      if (payment) {
        const { payerAddress, version } = payment;
        return {
          headers: createResponseHeaders(payerAddress, version),
        };
      }
    });
};
