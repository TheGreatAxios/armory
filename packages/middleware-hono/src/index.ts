import type { Context, Next } from "hono";
import type {
  PaymentPayloadV2,
  PaymentRequirements,
  SettlementResponse,
} from "@armory-sh/base";
import {
  createPaymentRequiredHeaders,
  createSettlementHeaders,
  PAYMENT_SIGNATURE_HEADER,
  decodePaymentV2,
} from "@armory-sh/base";

export interface AdvancedPaymentConfig {
  requirements: PaymentRequirements;
  facilitatorUrl?: string;
  skipVerification?: boolean;
  network?: string;
}

export interface AugmentedRequest extends Request {
  payment?: {
    payload: PaymentPayloadV2;
    payerAddress: string;
    verified: boolean;
  };
}

export const advancedPaymentMiddleware = (config: AdvancedPaymentConfig) => {
  const { requirements, facilitatorUrl, skipVerification = false, network = "base" } = config;

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

    let paymentPayload: PaymentPayloadV2 | null = null;
    try {
      paymentPayload = decodePaymentV2(paymentHeader);
    } catch (e) {
      c.status(400);
      return c.json({ error: "Invalid payment payload", details: String(e) });
    }

    if (!paymentPayload) {
      c.status(400);
      return c.json({ error: "Invalid payment payload" });
    }

    const payerAddress = paymentPayload.payload.authorization.from;

    c.set("payment", {
      payload: paymentPayload,
      payerAddress,
      verified: !skipVerification,
    });

    return next();
  };
};

export { paymentMiddleware, createPaymentRequirements, type PaymentConfig } from "./simple";
