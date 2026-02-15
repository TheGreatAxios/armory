import type { Context, Next } from "hono";
import type {
  X402PaymentPayload,
  PaymentRequirements,
  SettlementResponse,
} from "@armory-sh/base";
import {
  createPaymentRequiredHeaders,
  createSettlementHeaders,
  PAYMENT_SIGNATURE_HEADER,
  decodePayment,
} from "@armory-sh/base";

export interface PaymentMiddlewareConfig {
  requirements: PaymentRequirements;
  facilitatorUrl?: string;
  skipVerification?: boolean;
  network?: string;
}

export interface AugmentedRequest extends Request {
  payment?: {
    payload: X402PaymentPayload;
    payerAddress: string;
    verified: boolean;
  };
}

export const paymentMiddleware = (config: PaymentMiddlewareConfig) => {
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

    let paymentPayload: X402PaymentPayload | null = null;
    try {
      paymentPayload = decodePayment(paymentHeader);
    } catch {
      c.status(400);
      return c.json({ error: "Invalid payment payload" });
    }

    if (!paymentPayload) {
      c.status(400);
      return c.json({ error: "Invalid payment payload" });
    }

    const payerAddress = paymentPayload.payload.authorization.from;

    // TODO: Add verification with facilitator if not skipVerification
    // if (!skipVerification && facilitatorUrl) {
    //   const result = await verifyWithFacilitator(...);
    //   if (!result.success) { ... }
    // }

    const settlement: SettlementResponse = {
      success: true,
      transaction: "",
      network: network as any,
    };

    const settlementHeaders = createSettlementHeaders(settlement);
    for (const [key, value] of Object.entries(settlementHeaders)) {
      c.header(key, value);
    }

    c.set("payment", {
      payload: paymentPayload,
      payerAddress,
      verified: !skipVerification,
    });

    return next();
  };
};
