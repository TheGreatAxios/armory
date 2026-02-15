import type { Request, Response, NextFunction } from "express";
import type {
  X402PaymentPayload,
  X402PaymentRequirements,
} from "@armory-sh/base";
import type {
  PaymentPayload,
  PaymentRequirements,
} from "./payment-utils";
import {
  PAYMENT_HEADERS,
  encodeRequirements,
  decodePayload,
  verifyPaymentWithRetry,
  extractPayerAddress,
} from "./payment-utils";

export interface PaymentMiddlewareConfig {
  requirements: X402PaymentRequirements;
  facilitatorUrl?: string;
}

export interface AugmentedRequest extends Request {
  payment?: {
    payload: X402PaymentPayload;
    payerAddress: string;
    verified: boolean;
  };
}

const sendError = (
  res: Response,
  status: number,
  headers: Record<string, string>,
  body: unknown
): void => {
  res.status(status);
  Object.entries(headers).forEach(([k, v]) => res.setHeader(k, v));
  res.json(body);
};

export const paymentMiddleware = (config: PaymentMiddlewareConfig) => {
  const { requirements, facilitatorUrl } = config;

  return async (req: AugmentedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const paymentHeader = req.headers[PAYMENT_HEADERS.PAYMENT.toLowerCase()] as string | undefined;

      if (!paymentHeader) {
        sendError(res, 402, { [PAYMENT_HEADERS.REQUIRED]: encodeRequirements(requirements), "Content-Type": "application/json" }, { error: "Payment required", accepts: [requirements] });
        return;
      }

      let payload: X402PaymentPayload;
      try {
        ({ payload } = decodePayload(paymentHeader) as { payload: X402PaymentPayload });
      } catch (error) {
        sendError(res, 400, {}, { error: "Invalid payment payload", message: error instanceof Error ? error.message : "Unknown error" });
        return;
      }

      const result = await verifyPaymentWithRetry(payload, requirements, facilitatorUrl);
      if (!result.success) {
        sendError(res, 402, { [PAYMENT_HEADERS.RESPONSE]: JSON.stringify({ status: "verified", payerAddress: result.payerAddress, version: 2 }) }, { error: result.error });
        return;
      }

      const payerAddress = result.payerAddress!;

      req.payment = { payload, payerAddress, verified: true };
      res.setHeader(PAYMENT_HEADERS.RESPONSE, JSON.stringify({ status: "verified", payerAddress, version: 2 }));
      next();
    } catch (error) {
      sendError(res, 500, {}, { error: "Payment middleware error", message: error instanceof Error ? error.message : "Unknown error" });
    }
  };
};
