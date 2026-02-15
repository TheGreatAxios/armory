import { Elysia } from "elysia";
import type {
  X402PaymentPayload,
  X402PaymentRequirements,
} from "@armory-sh/base";
import {
  createPaymentRequiredHeaders,
  createSettlementHeaders,
  matchRoute,
  validateRouteConfig,
  type RouteValidationError,
} from "@armory-sh/base";
import {
  decodePayload,
  verifyPaymentWithRetry,
  settlePaymentWithRetry,
  PAYMENT_HEADERS,
} from "./payment-utils";

export interface RouteAwarePaymentMiddlewareConfig {
  route?: string;
  routes?: string[];
  perRoute?: Record<string, PaymentMiddlewareConfigEntry>;
}

export interface PaymentMiddlewareConfigEntry {
  requirements: X402PaymentRequirements;
  facilitatorUrl?: string;
}

export interface RouteAwarePaymentInfo {
  payload: X402PaymentPayload;
  payerAddress: string;
  verified: boolean;
  route?: string;
}

export interface PaymentContext {
  payment: RouteAwarePaymentInfo;
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

const errorResponse = (
  error: string | Record<string, unknown>,
  status: number,
  headers?: Record<string, string>
): Response =>
  new Response(JSON.stringify(error), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });

export const routeAwarePaymentMiddleware = (
  perRouteConfig: Record<string, PaymentMiddlewareConfigEntry>
) => {
  const config: RouteAwarePaymentMiddlewareConfig = {
    routes: Object.keys(perRouteConfig),
    perRoute: perRouteConfig,
  };

  const { routes: resolvedRoutes, error: configError } = resolveRouteConfig(config);

  return new Elysia({ name: "armory-route-aware-payment" })
    .derive(() => ({
      payment: undefined as RouteAwarePaymentInfo | undefined,
    }))
    .onBeforeHandle(async (context) => {
      try {
        if (configError) {
          return errorResponse(
            { error: "Payment middleware configuration error", details: configError.message },
            500
          );
        }

        const path = new URL(context.request.url).pathname;
        const matchedRoute = resolvedRoutes.find((r) => matchRoute(r.pattern, path));

        if (!matchedRoute) {
          return;
        }

        const routeConfig = matchedRoute.config;
        const { requirements, facilitatorUrl } = routeConfig;

        const paymentHeader = context.request.headers.get(PAYMENT_HEADERS.PAYMENT);

        if (!paymentHeader) {
          return errorResponse(
            { error: "Payment required", accepts: [requirements] },
            402,
            createPaymentRequiredHeaders(requirements)
          );
        }

        let payload: X402PaymentPayload;
        try {
          ({ payload } = decodePayload(paymentHeader) as { payload: X402PaymentPayload });
        } catch (error) {
          return errorResponse({
            error: "Invalid payment payload",
            message: error instanceof Error ? error.message : "Unknown error",
          }, 400);
        }

        const verifyResult = await verifyPaymentWithRetry(payload, requirements, facilitatorUrl);

        if (!verifyResult.success) {
          return errorResponse(
            { error: verifyResult.error },
            402,
            createPaymentRequiredHeaders(requirements)
          );
        }

        const payerAddress = verifyResult.payerAddress ?? payload.payload.authorization.from;
        (context as { payment?: RouteAwarePaymentInfo }).payment = { payload, payerAddress, verified: true, route: matchedRoute.pattern };
      } catch (error) {
        return errorResponse({
          error: "Payment middleware error",
          message: error instanceof Error ? error.message : "Unknown error",
        }, 500);
      }
    })
    .onAfterHandle(async (context) => {
      const payment = context.payment;
      if (!payment) {
        return;
      }

      const statusCode = typeof context.set.status === "number" ? context.set.status : 200;
      if (statusCode >= 400) {
        return;
      }

      const matchedRoute = payment.route ? resolvedRoutes.find((route) => route.pattern === payment.route) : undefined;
      const routeConfig = matchedRoute?.config;
      if (!routeConfig) {
        return;
      }

      const settlementResult = await settlePaymentWithRetry(payment.payload, routeConfig.requirements, routeConfig.facilitatorUrl);
      if (!settlementResult.success) {
        return errorResponse({ error: "Settlement failed", details: settlementResult.error }, 502);
      }

      return {
        headers: createSettlementHeaders(settlementResult),
      };
    });
};
