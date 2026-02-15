import type { Request, Response, NextFunction } from "express";
import type {
  PaymentPayloadV2,
  PaymentRequirements,
} from "@armory-sh/base";
import {
  decodePaymentV2,
  createPaymentRequiredHeaders,
  createSettlementHeaders,
  PAYMENT_SIGNATURE_HEADER,
  matchRoute,
  validateRouteConfig,
  type RouteValidationError,
} from "@armory-sh/base";

export interface RouteAwarePaymentMiddlewareConfig {
  route?: string;
  routes?: string[];
  perRoute?: Record<string, PaymentMiddlewareConfigEntry>;
}

export interface PaymentMiddlewareConfigEntry {
  requirements: PaymentRequirements;
  facilitatorUrl?: string;
  network?: string;
}

export interface AugmentedRequest extends Request {
  payment?: {
    payload: PaymentPayloadV2;
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
      const { requirements, facilitatorUrl, network = "base" } = routeConfig;

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

      let paymentPayload: PaymentPayloadV2;
      try {
        paymentPayload = decodePaymentV2(paymentHeader);
      } catch (error) {
        res.statusCode = 400;
        res.json({
          error: "Invalid payment payload",
          message: error instanceof Error ? error.message : "Unknown error",
        });
        return;
      }

      const payerAddress = paymentPayload.payload.authorization.from;

      const settlement = {
        success: true,
        transaction: "",
        network,
      };

      const settlementHeaders = createSettlementHeaders(settlement);
      for (const [key, value] of Object.entries(settlementHeaders)) {
        res.setHeader(key, value);
      }

      req.payment = {
        payload: paymentPayload,
        payerAddress,
        verified: true,
        route: matchedRoute.pattern,
      };
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
