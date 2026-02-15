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
  matchRoute,
  validateRouteConfig,
  type RouteValidationError,
} from "@armory-sh/base";
import {
  decodePayload,
  type AnyPaymentPayload,
  verifyPaymentWithRetry,
  settlePaymentWithRetry,
} from "./payment-utils";

export interface RouteAwarePaymentMiddlewareConfig {
  route?: string;
  routes?: string[];
  perRoute?: Record<string, PaymentMiddlewareConfigEntry>;
}

export interface PaymentMiddlewareConfigEntry {
  requirements: PaymentRequirements;
  facilitatorUrl?: string;
}

export interface AugmentedRequest extends Request {
  payment?: {
    payload: X402PaymentPayload;
    payerAddress: string;
    verified: boolean;
    route?: string;
  };
}

interface ResolvedRouteConfig {
  pattern: string;
  config: PaymentMiddlewareConfigEntry;
}

const resolveRouteConfig = (
  config: RouteAwarePaymentMiddlewareConfig
): { routes: ResolvedRouteConfig[]; error?: RouteValidationError } => {
  const validationError = validateRouteConfig(config);
  if (validationError) {
    return { routes: [], error: validationError };
  }

  const { route, routes, perRoute } = config;
  const routePatterns = route ? [route] : routes || [];

  const resolvedRoutes: ResolvedRouteConfig[] = [];

  for (const pattern of routePatterns) {
    const routeConfig = perRoute?.[pattern];
    if (routeConfig) {
      resolvedRoutes.push({
        pattern,
        config: routeConfig,
      });
    }
  }

  return { routes: resolvedRoutes };
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

export const routeAwarePaymentMiddleware = (
  perRouteConfig: Record<string, PaymentMiddlewareConfigEntry>
) => {
  const config: RouteAwarePaymentMiddlewareConfig = {
    routes: Object.keys(perRouteConfig),
    perRoute: perRouteConfig,
  };

  const { routes: resolvedRoutes, error: configError } = resolveRouteConfig(config);

  return async (req: AugmentedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (configError) {
        res.statusCode = 500;
        res.json({
          error: "Payment middleware configuration error",
          details: configError.message,
        });
        return;
      }

      const path = req.path;
      const matchedRoute = resolvedRoutes.find((r) => matchRoute(r.pattern, path));

      if (!matchedRoute) {
        next();
        return;
      }

      const routeConfig = matchedRoute.config;
      const { requirements, facilitatorUrl } = routeConfig;

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

      req.payment = {
        payload: paymentPayload as X402PaymentPayload,
        payerAddress,
        verified: true,
        route: matchedRoute.pattern,
      };

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
