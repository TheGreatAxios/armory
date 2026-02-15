import { Elysia } from "elysia";
import type {
  X402PaymentPayload,
  X402PaymentRequirements,
} from "@armory-sh/base";
import type {
  PaymentPayload,
  PaymentRequirements,
} from "./payment-utils";
import {
  encodeRequirements,
  decodePayload,
  verifyPaymentWithRetry,
  extractPayerAddress,
  createResponseHeaders,
  PAYMENT_HEADERS,
} from "./payment-utils";
import { matchRoute, validateRouteConfig, type RouteValidationError } from "@armory-sh/base";

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
    .onBeforeHandle(async ({ payment, request }) => {
      try {
        if (configError) {
          return errorResponse(
            { error: "Payment middleware configuration error", details: configError.message },
            500
          );
        }

        const path = new URL(request.url).pathname;
        const matchedRoute = resolvedRoutes.find((r) => matchRoute(r.pattern, path));

        if (!matchedRoute) {
          return;
        }

        const routeConfig = matchedRoute.config;
        const { requirements, facilitatorUrl } = routeConfig;

        const paymentHeader = request.headers.get(PAYMENT_HEADERS.PAYMENT);

        if (!paymentHeader) {
          return errorResponse(
            { error: "Payment required", accepts: [requirements] },
            402,
            { [PAYMENT_HEADERS.REQUIRED]: encodeRequirements(requirements) }
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
            { [PAYMENT_HEADERS.REQUIRED]: encodeRequirements(requirements) }
          );
        }

        const payerAddress = verifyResult.payerAddress!;
        (payment as RouteAwarePaymentInfo) = { payload, payerAddress, verified: true, route: matchedRoute.pattern };
      } catch (error) {
        return errorResponse({
          error: "Payment middleware error",
          message: error instanceof Error ? error.message : "Unknown error",
        }, 500);
      }
    })
    .onAfterHandle(({ payment }) => {
      if (payment) {
        const { payerAddress } = payment;
        return {
          headers: createResponseHeaders(payerAddress),
        };
      }
    });
};
