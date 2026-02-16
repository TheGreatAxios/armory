import type { X402PaymentPayload, X402SettlementResponse, X402Network, RouteValidationError, PaymentRequirements } from "@armory-sh/base";
import { decodePayloadHeader, extractPayerAddress, verifyPayment, settlePayment, createPaymentRequiredHeaders, createSettlementHeaders, PAYMENT_SIGNATURE_HEADER, matchRoute, validateRouteConfig } from "@armory-sh/base";
import type { MiddlewareConfig } from "./types";
import { createPaymentRequirements } from "./core";
import type { BunHandler } from "./index";

export type BunMiddleware = (request: Request) => Promise<Response | null>;

export interface RouteAwareBunMiddlewareConfig extends MiddlewareConfig {
  route?: string;
  routes?: string[];
  perRoute?: Record<string, Partial<MiddlewareConfig>>;
  waitForSettlement?: boolean;
}

type ParsedPayment = {
  payload: X402PaymentPayload;
  payerAddress: string;
};

interface ResolvedRouteConfig {
  pattern: string;
  config: RouteAwareBunMiddlewareConfig;
}

const resolveRouteConfig = (
  config: RouteAwareBunMiddlewareConfig
): { routes: ResolvedRouteConfig[]; error?: RouteValidationError } => {
  const validationError = validateRouteConfig(config);
  if (validationError) {
    return { routes: [], error: validationError };
  }

  const { route, routes, perRoute, ...baseConfig } = config;
  const routePatterns = route ? [route] : routes || [];

  const resolvedRoutes: ResolvedRouteConfig[] = [];

  for (const pattern of routePatterns) {
    const perRouteOverride = perRoute?.[pattern];
    const mergedConfig: RouteAwareBunMiddlewareConfig = {
      ...baseConfig,
      ...perRouteOverride,
    };

    resolvedRoutes.push({
      pattern,
      config: mergedConfig,
    });
  }

  return { routes: resolvedRoutes };
};

const parsePaymentHeader = async (request: Request, requirements: PaymentRequirements): Promise<ParsedPayment | null> => {
  const paymentSig = request.headers.get(PAYMENT_SIGNATURE_HEADER);
  if (paymentSig) {
    try {
      const payload = decodePayloadHeader(paymentSig, { accepted: requirements });
      return { payload, payerAddress: extractPayerAddress(payload) };
    } catch {
    }
  }

  return null;
};

const errorResponse = (
  error: string,
  status: number,
  headers?: Record<string, string>,
  accepts?: unknown[]
): Response =>
  new Response(JSON.stringify({ error, accepts }), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });

const createSettlementResponse = (
  success: boolean,
  txHash?: string
): X402SettlementResponse => ({
  success,
  transaction: txHash ?? "",
  errorReason: success ? undefined : "Settlement failed",
  network: "base" as X402Network,
});

const successResponse = (
  payerAddress: string,
  settlement?: X402SettlementResponse
): Response => {
  const isSuccess = settlement?.success;
  const txHash = settlement?.transaction;

  return new Response(
    JSON.stringify({
      verified: true,
      payerAddress,
      settlement: settlement ? { success: isSuccess, txHash } : undefined,
    }),
    {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "X-Payment-Verified": "true",
        "X-Payer-Address": payerAddress,
        ...(settlement ? createSettlementHeaders(settlement) : {}),
      },
    },
  );
};

const appendSettlementHeaders = (
  response: Response,
  settlement: X402SettlementResponse
): Response => {
  const headers = new Headers(response.headers);
  const settlementHeaders = createSettlementHeaders(settlement);
  for (const [key, value] of Object.entries(settlementHeaders)) {
    headers.set(key, value);
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
};

export const createRouteAwareBunMiddleware = (
  config: RouteAwareBunMiddlewareConfig,
  handler?: BunHandler
): BunMiddleware | ((request: Request) => Promise<Response>) => {
  const { routes: resolvedRoutes, error: configError } = resolveRouteConfig(config);

  const middleware = async (request: Request): Promise<Response | null> => {
    if (configError) {
      return errorResponse(`Payment middleware configuration error: ${configError.message}`, 500);
    }

    const path = new URL(request.url).pathname;
    const matchedRoute = resolvedRoutes.find((r) => matchRoute(r.pattern, path));

    if (!matchedRoute) {
      return null;
    }

    const routeConfig = matchedRoute.config;
    const { facilitator, settlementMode = "settle", waitForSettlement = false } = routeConfig;
    const requirements = createPaymentRequirements(routeConfig);

    const paymentResult = await parsePaymentHeader(request, requirements);

    if (!paymentResult) {
      return errorResponse("Payment required", 402, createPaymentRequiredHeaders(requirements), [requirements]);
    }

    const { payerAddress, payload } = paymentResult;

    if (facilitator) {
      const verifyResult = await verifyPayment(payload, requirements, { url: facilitator.url });
      if (!verifyResult.isValid) {
        return errorResponse(`Payment verification failed: ${verifyResult.invalidReason}`, 402, createPaymentRequiredHeaders(requirements), [requirements]);
      }
    }

    if (!handler) {
      if (settlementMode === "settle" && facilitator) {
        const settle = async () => {
          const result = await settlePayment(payload, requirements, { url: facilitator.url });
          return result.success
            ? successResponse(payerAddress, createSettlementResponse(true, result.transaction))
            : errorResponse(result.errorReason ?? "Settlement failed", 400);
        };

        if (waitForSettlement) {
          return await settle();
        }
        settle().catch(console.error);
        return successResponse(payerAddress);
      }

      return successResponse(payerAddress);
    }

    const response = await handler(request);
    if (response.status >= 400 || settlementMode !== "settle" || !facilitator) {
      return response;
    }

    const settleResult = await settlePayment(payload, requirements, { url: facilitator.url });
    if (!settleResult.success) {
      return errorResponse(settleResult.errorReason ?? "Settlement failed", 502);
    }

    const settlement = createSettlementResponse(true, settleResult.transaction);
    return appendSettlementHeaders(response, settlement);
  };

  if (!handler) {
    return middleware;
  }

  return async (request: Request): Promise<Response> => {
    const result = await middleware(request);
    if (!result) {
      return handler(request);
    }
    return result;
  };
};
