import type { Context } from "elysia";
import type {
  PaymentPayload,
  PaymentRequirements,
} from "@armory/core";
import type { VerifyPaymentOptions } from "@armory/facilitator";
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
  verifyOptions?: VerifyPaymentOptions;
  skipVerification?: boolean;
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
  const { requirements, facilitatorUrl, verifyOptions, skipVerification = false } = config;
  const version = getRequirementsVersion(requirements);
  const headers = getHeadersForVersion(version);

  return {
    beforeHandle: async (
      context: Context & { store: Record<string, unknown> }
    ): Promise<unknown> => {
      try {
        const paymentHeader = context.request.headers.get(headers.payment);

        if (!paymentHeader) {
          return errorResponse(
            { error: "Payment required", requirements },
            402,
            { [headers.required]: encodeRequirements(requirements) }
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

        const payerAddress = skipVerification
          ? extractPayerAddress(payload)
          : await (async () => {
              const result = await verifyPaymentWithRetry(payload, requirements, facilitatorUrl, verifyOptions);
              if (!result.success) {
                return errorResponse(
                  { error: result.error },
                  402,
                  { [headers.required]: encodeRequirements(requirements) }
                );
              }
              return result.payerAddress!;
            })();

        context.store.payment = { payload, payerAddress, version, verified: !skipVerification };
        context.set.headers = {
          ...context.set.headers,
          ...createResponseHeaders(payerAddress, version),
        };
      } catch (error) {
        return errorResponse({
          error: "Payment middleware error",
          message: error instanceof Error ? error.message : "Unknown error",
        }, 500);
      }
    },
  };
};
