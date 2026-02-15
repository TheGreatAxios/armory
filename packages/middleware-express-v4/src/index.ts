import type { Request, Response, NextFunction } from "express";
import type {
  X402PaymentPayload,
  X402PaymentRequirements,
} from "@armory-sh/base";
import {
  createPaymentRequiredHeaders,
  createSettlementHeaders,
} from "@armory-sh/base";
import {
  PAYMENT_HEADERS,
  decodePayload,
  verifyPaymentWithRetry,
  settlePaymentWithRetry,
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
      const paymentHeader = req.headers[PAYMENT_HEADERS.PAYMENT.toLowerCase()] as string | undefined;

      if (!paymentHeader) {
        sendError(res, 402, createPaymentRequiredHeaders(requirements), { error: "Payment required", accepts: [requirements] });
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
        sendError(res, 402, createPaymentRequiredHeaders(requirements), { error: result.error });
        return;
      }

      const payerAddress = result.payerAddress ?? payload.payload.authorization.from;

      req.payment = { payload, payerAddress, verified: true };

      installSettlementHook(res, async () => settlePaymentWithRetry(payload, requirements, facilitatorUrl));

      next();
    } catch (error) {
      sendError(res, 500, {}, { error: "Payment middleware error", message: error instanceof Error ? error.message : "Unknown error" });
    }
  };
};

export { routeAwarePaymentMiddleware, type RouteAwarePaymentMiddlewareConfig, type PaymentMiddlewareConfigEntry } from "./routes";
