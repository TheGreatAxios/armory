import { Elysia } from "elysia";
import type {
  X402PaymentPayload,
  X402PaymentRequirements,
} from "@armory-sh/base";
import {
  createPaymentRequiredHeaders,
  createSettlementHeaders,
} from "@armory-sh/base";
import {
  decodePayload,
  verifyPaymentWithRetry,
  settlePaymentWithRetry,
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
    .onBeforeHandle(async (context) => {
      try {
        const paymentHeader = context.request.headers.get(PAYMENT_HEADERS.PAYMENT);

        if (!paymentHeader) {
          return errorResponse(
            { error: "Payment required", accepts: [requirements] },
            402,
            createPaymentRequiredHeaders(requirements)
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
            createPaymentRequiredHeaders(requirements)
          );
        }

        const payerAddress = verifyResult.payerAddress ?? payload.payload.authorization.from;
        (context as { payment?: PaymentInfo }).payment = { payload, payerAddress, verified: true };
      } catch (error) {
        return errorResponse({
          error: "Payment middleware error",
          message: error instanceof Error ? error.message : "Unknown error",
        }, 500);
      }
    })
    .onAfterHandle(async (context) => {
      const payment = context.payment;
      if (!payment) {
        return;
      }

      const statusCode = typeof context.set.status === "number" ? context.set.status : 200;
      if (statusCode >= 400) {
        return;
      }

      const settlementResult = await settlePaymentWithRetry(payment.payload, requirements, facilitatorUrl);
      if (!settlementResult.success) {
        return errorResponse({ error: "Settlement failed", details: settlementResult.error }, 502);
      }

      return {
        headers: createSettlementHeaders(settlementResult),
      };
    });
};

export { routeAwarePaymentMiddleware, type RouteAwarePaymentMiddlewareConfig, type PaymentMiddlewareConfigEntry, type RouteAwarePaymentInfo } from "./routes";
