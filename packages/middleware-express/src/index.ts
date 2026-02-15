import type { Request, Response, NextFunction } from "express";
import type {
  X402PaymentPayload,
  PaymentRequirements,
  SettlementResponse,
} from "@armory-sh/base";
import {
  createPaymentRequiredHeaders,
  createSettlementHeaders,
  PAYMENT_SIGNATURE_HEADER,
} from "@armory-sh/base";
import {
  decodePayload,
  type AnyPaymentPayload,
  verifyPaymentWithRetry,
  settlePaymentWithRetry,
} from "./payment-utils";

export interface PaymentMiddlewareConfig {
  requirements: PaymentRequirements;
  facilitatorUrl?: string;
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
  settle: () => Promise<{ success: boolean; error?: string; transaction?: string; network?: string }>
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
          end(JSON.stringify({ error: "Settlement failed", details: settlement.error }));
          return;
        }

        return;
      }

      const normalizedSettlement: SettlementResponse = {
        success: settlement.success,
        transaction: settlement.transaction ?? "",
        network: (settlement.network ?? "eip155:8453") as `eip155:${string}`,
        errorReason: settlement.error,
      };

      const settlementHeaders = createSettlementHeaders(normalizedSettlement);
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

      let paymentPayload: AnyPaymentPayload;
      try {
        const decoded = decodePayload(paymentHeader);
        paymentPayload = decoded.payload;
      } catch (error) {
        res.statusCode = 400;
        res.json({
          error: "Invalid payment payload",
          message: error instanceof Error ? error.message : "Unknown error",
        });
        return;
      }

      const verifyResult = await verifyPaymentWithRetry(paymentPayload, requirements, facilitatorUrl);
      if (!verifyResult.success) {
        const requiredHeaders = createPaymentRequiredHeaders(requirements);
        res.statusCode = 402;
        for (const [key, value] of Object.entries(requiredHeaders)) {
          res.setHeader(key, value);
        }
        res.json({
          error: "Payment verification failed",
          message: verifyResult.error,
        });
        return;
      }

      const payerAddress = verifyResult.payerAddress ?? ("payload" in paymentPayload ? paymentPayload.payload.authorization.from : paymentPayload.from);

      req.payment = { payload: paymentPayload as X402PaymentPayload, payerAddress, verified: true };

      installSettlementHook(res, async () => settlePaymentWithRetry(paymentPayload, requirements, facilitatorUrl));

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
