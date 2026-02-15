import type { Context, Next } from "hono";
import type {
  X402PaymentPayload,
  PaymentRequirements,
} from "@armory-sh/base";
import {
  createPaymentRequiredHeaders,
  createSettlementHeaders,
  PAYMENT_SIGNATURE_HEADER,
} from "@armory-sh/base";
import { decodePayload, type AnyPaymentPayload, settlePaymentWithRetry, verifyPaymentWithRetry } from "./payment-utils";

export interface AdvancedPaymentConfig {
  requirements: PaymentRequirements;
  facilitatorUrl?: string;
  network?: string;
}

export interface AugmentedRequest extends Request {
  payment?: {
    payload: X402PaymentPayload;
    payerAddress: string;
    verified: boolean;
  };
}

export const advancedPaymentMiddleware = (config: AdvancedPaymentConfig) => {
  const { requirements, facilitatorUrl } = config;

  return async (c: Context, next: Next): Promise<Response | void> => {
    const paymentHeader = c.req.header(PAYMENT_SIGNATURE_HEADER);

    if (!paymentHeader) {
      const requiredHeaders = createPaymentRequiredHeaders(requirements);
      c.status(402);
      for (const [key, value] of Object.entries(requiredHeaders)) {
        c.header(key, value);
      }
      return c.json({
        error: "Payment required",
        accepts: [requirements],
      });
    }

    let paymentPayload: AnyPaymentPayload;
    try {
      ({ payload: paymentPayload } = decodePayload(paymentHeader));
    } catch (e) {
      c.status(400);
      return c.json({ error: "Invalid payment payload", details: String(e) });
    }

    const verifyResult = await verifyPaymentWithRetry(paymentPayload, requirements, facilitatorUrl);
    if (!verifyResult.success) {
      const requiredHeaders = createPaymentRequiredHeaders(requirements);
      c.status(402);
      for (const [key, value] of Object.entries(requiredHeaders)) {
        c.header(key, value);
      }
      return c.json({
        error: "Payment verification failed",
        message: verifyResult.error,
      });
    }

    const payerAddress = verifyResult.payerAddress ?? ("payload" in paymentPayload ? paymentPayload.payload.authorization.from : paymentPayload.from);

    c.set("payment", {
      payload: paymentPayload as X402PaymentPayload,
      payerAddress,
      verified: true,
    });

    await next();

    if (c.res.status >= 400) {
      return;
    }

    const settleResult = await settlePaymentWithRetry(paymentPayload, requirements, facilitatorUrl);
    if (!settleResult.success) {
      c.status(502);
      c.res = c.json({ error: "Settlement failed", details: settleResult.error }, 502);
      return;
    }

    const settlementHeaders = createSettlementHeaders(settleResult);
    for (const [key, value] of Object.entries(settlementHeaders)) {
      c.header(key, value);
    }
  };
};

export { paymentMiddleware, createPaymentRequirements, type PaymentConfig } from "./simple";

export { routeAwarePaymentMiddleware, type RouteAwarePaymentConfig } from "./routes";

export {
  buildExtensions,
  extractExtension,
  type ExtensionConfig,
} from "./extensions";
