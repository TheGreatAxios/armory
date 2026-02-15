import { Elysia } from "elysia";
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
  decodePayloadHeader,
  verifyPayment,
  settlePayment,
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
  requirements: X402PaymentRequirements;
  facilitatorUrl: string;
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

        const paymentHeader = context.request.headers.get(PAYMENT_SIGNATURE_HEADER);

        if (!paymentHeader) {
          return errorResponse(
            { error: "Payment required", accepts: [requirements] },
            402,
            createPaymentRequiredHeaders(requirements)
          );
        }

        let payload: X402PaymentPayload;
        try {
          payload = decodePayloadHeader(paymentHeader, {
          scheme: requirements.scheme,
          network: requirements.network,
        });
        } catch (error) {
          return errorResponse({
            error: "Invalid payment payload",
            message: error instanceof Error ? error.message : "Unknown error",
          }, 400);
        }

        if (!facilitatorUrl) {
          return errorResponse({ error: "Payment middleware configuration error", message: "Facilitator URL is required for verification" }, 500);
        }

        const verifyConfig = { url: facilitatorUrl };
        const verifyResult: VerifyResponse = await verifyPayment(payload, requirements, verifyConfig);

        if (!verifyResult.isValid) {
          return errorResponse(
            { error: verifyResult.invalidReason },
            402,
            createPaymentRequiredHeaders(requirements)
          );
        }

        const payerAddress = verifyResult.payer ?? payload.payload.authorization.from;
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

      if (!routeConfig.facilitatorUrl) {
        return errorResponse({ error: "Payment middleware configuration error", message: "Facilitator URL is required for settlement" }, 500);
      }

      const settleConfig = { url: routeConfig.facilitatorUrl };
      const settlementResult: X402SettlementResponse = await settlePayment(payment.payload, routeConfig.requirements, settleConfig);

      if (!settlementResult.success) {
        return errorResponse({ error: "Settlement failed", details: settlementResult.errorReason }, 502);
      }

      return {
        headers: createSettlementHeaders(settlementResult),
      };
    });
};
