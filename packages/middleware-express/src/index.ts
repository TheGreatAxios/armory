import type { Request, Response, NextFunction } from "express";
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

export interface PaymentMiddlewareConfig {
  requirements: PaymentRequirements;
  facilitatorUrl: string;
}

export interface AugmentedRequest extends Request {
  payment?: {
    payload: X402PaymentPayload;
    payerAddress: string;
    verified: boolean;
  };
}

const installSettlementHook = (
  res: Response,
  settle: () => Promise<X402SettlementResponse>
): void => {
  const end = res.end.bind(res);
  let intercepted = false;

  type EndFn = Response["end"];

  res.end = ((...args: Parameters<EndFn>) => {
    if (intercepted) {
      return end(...args);
    }

    intercepted = true;

    if (res.statusCode >= 400) {
      return end(...args);
    }

    void (async () => {
      const settlement = await settle();

      if (!settlement.success) {
        if (!res.headersSent) {
          res.statusCode = 502;
          res.setHeader("Content-Type", "application/json");
          end(JSON.stringify({ error: "Settlement failed", details: settlement.errorReason }));
          return;
        }

        return;
      }

      const settlementHeaders = createSettlementHeaders(settlement);
      for (const [key, value] of Object.entries(settlementHeaders)) {
        if (!res.headersSent) {
          res.setHeader(key, value);
        }
      }

      end(...args);
    })();

    return res;
  }) as EndFn;
};

export const paymentMiddleware = (config: PaymentMiddlewareConfig) => {
  const { requirements, facilitatorUrl } = config;

  return async (req: AugmentedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const paymentHeader = req.headers[PAYMENT_SIGNATURE_HEADER.toLowerCase()] as string | undefined;

      if (!paymentHeader) {
        const requiredHeaders = createPaymentRequiredHeaders(requirements);
        res.statusCode = 402;
        for (const [key, value] of Object.entries(requiredHeaders)) {
          res.setHeader(key, value);
        }
        res.json({
          error: "Payment required",
          accepts: [requirements],
        });
        return;
      }

      let paymentPayload: X402PaymentPayload;
      try {
        paymentPayload = decodePayloadHeader(paymentHeader, {
          scheme: requirements.scheme,
          network: requirements.network,
        });
      } catch (error) {
        res.statusCode = 400;
        res.json({
          error: "Invalid payment payload",
          message: error instanceof Error ? error.message : "Unknown error",
        });
        return;
      }

      if (!facilitatorUrl) {
        res.statusCode = 500;
        res.json({ error: "Payment middleware configuration error", message: "Facilitator URL is required for verification" });
        return;
      }

      const verifyResult: VerifyResponse = await verifyPayment(paymentPayload, requirements, { url: facilitatorUrl });

      if (!verifyResult.isValid) {
        const requiredHeaders = createPaymentRequiredHeaders(requirements);
        res.statusCode = 402;
        for (const [key, value] of Object.entries(requiredHeaders)) {
          res.setHeader(key, value);
        }
        res.json({
          error: "Payment verification failed",
          message: verifyResult.invalidReason,
        });
        return;
      }

      const payerAddress = verifyResult.payer ?? paymentPayload.payload.authorization.from;

      req.payment = { payload: paymentPayload, payerAddress, verified: true };
      installSettlementHook(res, async () => settlePayment(paymentPayload, requirements, { url: facilitatorUrl }));

      next();
    } catch (error) {
      res.statusCode = 500;
      res.json({
        error: "Payment middleware error",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  };
};

export { routeAwarePaymentMiddleware, type RouteAwarePaymentMiddlewareConfig, type PaymentMiddlewareConfigEntry } from "./routes";
