import type { Context, Next } from "hono";
import type {
  X402PaymentPayload,
  PaymentRequirements,
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

export interface AdvancedPaymentConfig {
  requirements: PaymentRequirements;
  facilitatorUrl: string;
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

    let paymentPayload: X402PaymentPayload;
    try {
      paymentPayload = decodePayloadHeader(paymentHeader, {
        accepted: requirements,
      });
    } catch (e) {
      c.status(400);
      return c.json({ error: "Invalid payment payload", details: String(e) });
    }

    if (!facilitatorUrl) {
      c.status(500);
      return c.json({ error: "Payment middleware configuration error", message: "Facilitator URL is required for verification" });
    }

    const verifyResult: VerifyResponse = await verifyPayment(paymentPayload, requirements, { url: facilitatorUrl });

    if (!verifyResult.isValid) {
      const requiredHeaders = createPaymentRequiredHeaders(requirements);
      c.status(402);
      for (const [key, value] of Object.entries(requiredHeaders)) {
        c.header(key, value);
      }
      return c.json({
        error: "Payment verification failed",
        message: verifyResult.invalidReason,
      });
    }

    const payerAddress = verifyResult.payer ?? paymentPayload.payload.authorization.from;

    c.set("payment", {
      payload: paymentPayload,
      payerAddress,
      verified: true,
    });

    await next();

    if (c.res.status >= 400) {
      return;
    }

    const settleResult: X402SettlementResponse = await settlePayment(paymentPayload, requirements, { url: facilitatorUrl });

    if (!settleResult.success) {
      c.status(502);
      c.res = c.json({ error: "Settlement failed", details: settleResult.errorReason }, 502);
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
