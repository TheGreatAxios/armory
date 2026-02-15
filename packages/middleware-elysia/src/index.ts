import type { Context } from "elysia";
import { Elysia } from "elysia";
import type {
  X402PaymentPayload,
  X402PaymentRequirements,
} from "@armory-sh/base";
import type {
  PaymentPayload,
  PaymentRequirements,
} from "./payment-utils";
import {
  encodeRequirements,
  decodePayload,
  verifyPaymentWithRetry,
  extractPayerAddress,
  createResponseHeaders,
  PAYMENT_HEADERS,
} from "./payment-utils";

export interface PaymentMiddlewareConfig {
  requirements: X402PaymentRequirements;
  facilitatorUrl?: string;
}

export interface PaymentInfo {
  payload: X402PaymentPayload;
  payerAddress: string;
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
  const { requirements, facilitatorUrl } = config;

  return new Elysia({ name: "armory-payment" })
    .derive(() => ({
      payment: undefined as PaymentInfo | undefined,
    }))
    .onBeforeHandle(async ({ payment, request }) => {
      try {
        const paymentHeader = request.headers.get(PAYMENT_HEADERS.PAYMENT);

        if (!paymentHeader) {
          return errorResponse(
            { error: "Payment required", accepts: [requirements] },
            402,
            { [PAYMENT_HEADERS.REQUIRED]: encodeRequirements(requirements) }
          );
        }

        let payload: X402PaymentPayload;
        try {
          ({ payload } = decodePayload(paymentHeader) as { payload: X402PaymentPayload });
        } catch (error) {
          return errorResponse({
            error: "Invalid payment payload",
            message: error instanceof Error ? error.message : "Unknown error",
          }, 400);
        }

        const verifyResult = await verifyPaymentWithRetry(payload, requirements, facilitatorUrl);

        if (!verifyResult.success) {
          return errorResponse(
            { error: verifyResult.error },
            402,
            { [PAYMENT_HEADERS.REQUIRED]: encodeRequirements(requirements) }
          );
        }

        const payerAddress = verifyResult.payerAddress!;
        (payment as PaymentInfo) = { payload, payerAddress, verified: true };
      } catch (error) {
        return errorResponse({
          error: "Payment middleware error",
          message: error instanceof Error ? error.message : "Unknown error",
        }, 500);
      }
    })
    .onAfterHandle(({ payment }) => {
      if (payment) {
        const { payerAddress } = payment;
        return {
          headers: createResponseHeaders(payerAddress),
        };
      }
    });
};

export { routeAwarePaymentMiddleware, type RouteAwarePaymentMiddlewareConfig, type PaymentMiddlewareConfigEntry, type RouteAwarePaymentInfo } from "./routes";
