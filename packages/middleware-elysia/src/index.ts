import { Elysia } from "elysia";
import type {
  X402PaymentPayload,
  X402PaymentRequirements,
  VerifyResponse,
  X402SettlementResponse,
} from "@armory-sh/base";
import {
  createPaymentRequiredHeaders,
  createSettlementHeaders,
  PAYMENT_SIGNATURE_HEADER,
  decodePayloadHeader,
  verifyPayment,
  settlePayment,
} from "@armory-sh/base";

export interface PaymentMiddlewareConfig {
  requirements: X402PaymentRequirements;
  facilitatorUrl: string;
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
        const paymentHeader = context.request.headers.get(PAYMENT_SIGNATURE_HEADER);

        if (!paymentHeader) {
          return errorResponse(
            { error: "Payment required", accepts: [requirements] },
            402,
            createPaymentRequiredHeaders(requirements)
          );
        }

        let paymentPayload: X402PaymentPayload;
        try {
          paymentPayload = decodePayloadHeader(paymentHeader, {
            accepted: requirements,
          });
        } catch (error) {
          return errorResponse({
            error: "Invalid payment payload",
            message: error instanceof Error ? error.message : "Unknown error",
          }, 400);
        }

        if (!facilitatorUrl) {
          return errorResponse({ error: "Payment middleware configuration error", message: "Facilitator URL is required for verification" }, 500);
        }

        const verifyConfig = { url: facilitatorUrl };
        const verifyResult: VerifyResponse = await verifyPayment(paymentPayload, requirements, verifyConfig);

        if (!verifyResult.isValid) {
          return errorResponse(
            { error: verifyResult.invalidReason },
            402,
            createPaymentRequiredHeaders(requirements)
          );
        }

        const payerAddress = verifyResult.payer ?? paymentPayload.payload.authorization.from;
        (context as { payment?: PaymentInfo }).payment = { payload: paymentPayload, payerAddress, verified: true };
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

      if (!facilitatorUrl) {
        return errorResponse({ error: "Payment middleware configuration error", message: "Facilitator URL is required for settlement" }, 500);
      }

      const settleConfig = { url: facilitatorUrl };
      const settlementResult: X402SettlementResponse = await settlePayment(payment.payload, requirements, settleConfig);

      if (!settlementResult.success) {
        return errorResponse({ error: "Settlement failed", details: settlementResult.errorReason }, 502);
      }

      return {
        headers: createSettlementHeaders(settlementResult),
      };
    });
};

export { routeAwarePaymentMiddleware, type RouteAwarePaymentMiddlewareConfig, type PaymentMiddlewareConfigEntry, type RouteAwarePaymentInfo } from "./routes";
export { paymentMiddleware, createPaymentRequirements, resolveFacilitatorUrlFromRequirement } from "./payment";
export type { PaymentConfig, ResolvedRequirementsConfig } from "./payment";
