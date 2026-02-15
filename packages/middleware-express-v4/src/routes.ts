import type { Request, Response, NextFunction } from "express";
import type {
  X402PaymentPayload,
  X402PaymentRequirements,
  VerifyResponse,
  X402SettlementResponse,
} from "@armory-sh/base";
import {
  createPaymentRequiredHeaders,
  createSettlementHeaders,
  PAYMENT_SIGNATURE_HEADER,
  matchRoute,
  validateRouteConfig,
  type RouteValidationError,
  decodePayloadHeader,
  verifyPayment,
  settlePayment,
} from "@armory-sh/base";

export interface RouteAwarePaymentMiddlewareConfig {
  route?: string;
  routes?: string[];
  perRoute?: Record<string, PaymentMiddlewareConfigEntry>;
}

export interface PaymentMiddlewareConfigEntry {
  requirements: X402PaymentRequirements;
  facilitatorUrl: string;
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
        sendError(res, 500, {}, { error: "Payment middleware configuration error", details: configError.message });
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
        sendError(res, 402, requiredHeaders, { error: "Payment required", accepts: [requirements] });
        return;
      }

      let paymentPayload: X402PaymentPayload;
      try {
        paymentPayload = decodePayloadHeader(paymentHeader, {
          scheme: requirements.scheme,
          network: requirements.network,
        });
      } catch (error) {
        sendError(res, 400, {}, { error: "Invalid payment payload", message: error instanceof Error ? error.message : "Unknown error" });
        return;
      }

      const verifyResult: VerifyResponse = facilitatorUrl
        ? await verifyPayment(paymentPayload, requirements, { url: facilitatorUrl })
        : { isValid: false, invalidReason: "Facilitator URL is required for verification" };

      if (!verifyResult.isValid) {
        const requiredHeaders = createPaymentRequiredHeaders(requirements);
        sendError(res, 402, requiredHeaders, { error: "Payment verification failed", message: verifyResult.invalidReason });
        return;
      }

      const payerAddress = verifyResult.payer ?? paymentPayload.payload.authorization.from;

      req.payment = { payload: paymentPayload, payerAddress, verified: true, route: matchedRoute.pattern };

      installSettlementHook(res, async () => facilitatorUrl
        ? settlePayment(paymentPayload, requirements, { url: facilitatorUrl })
        : { success: false, errorReason: "Facilitator URL is required for settlement" }
      );

      next();
    } catch (error) {
      sendError(res, 500, {}, { error: "Payment middleware error", message: error instanceof Error ? error.message : "Unknown error" });
    }
  };
};
