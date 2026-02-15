import { decodePayment, isExactEvmPayload, matchRoute, validateRouteConfig, type X402PaymentPayload as PaymentPayload, type X402SettlementResponse as SettlementResponse, type X402Network, type RouteValidationError } from "@armory-sh/base";
import type { MiddlewareConfig, HttpRequest } from "./types";
import {
  createPaymentRequirements,
  verifyWithFacilitator,
  settleWithFacilitator,
  createPaymentRequiredHeaders,
  createSettlementHeaders,
} from "./core";

export type BunMiddleware = (request: Request) => Promise<Response | null>;

export interface RouteAwareBunMiddlewareConfig extends MiddlewareConfig {
  route?: string;
  routes?: string[];
  perRoute?: Record<string, Partial<MiddlewareConfig>>;
  defaultVersion?: 1 | 2;
  waitForSettlement?: boolean;
}

type PaymentVersion = 1 | 2;

type ParsedPayment = {
  payload: PaymentPayload;
  version: PaymentVersion;
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

const parsePaymentHeader = async (request: Request): Promise<ParsedPayment | null> => {
  const paymentSig = request.headers.get("PAYMENT-SIGNATURE");
  if (paymentSig) {
    try {
      const payload = decodePayment(paymentSig);
      if (isExactEvmPayload(payload)) {
        return { payload: payload as PaymentPayload, version: 2, payerAddress: payload.authorization.from };
      }
    } catch {
    }
  }

  const xPayment = request.headers.get("X-PAYMENT");
  if (xPayment) {
    try {
      const payload = decodePayment(xPayment);
      if (isExactEvmPayload(payload)) {
        return { payload: payload as PaymentPayload, version: 2, payerAddress: payload.authorization.from };
      }
      if (payload && typeof payload === "object" && "from" in payload && typeof payload.from === "string") {
        return { payload, version: 1, payerAddress: payload.from };
      }
    } catch {
    }
  }

  return null;
};

const toHttpRequest = (request: Request): HttpRequest => {
  const headers: Record<string, string | string[] | undefined> = {};
  request.headers.forEach((v, k) => { headers[k] = v; });
  return { headers, method: request.method, url: request.url };
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
): SettlementResponse => ({
  success,
  transaction: txHash ?? "",
  errorReason: success ? undefined : "Settlement failed",
  network: "base" as X402Network,
});

const successResponse = (
  payerAddress: string,
  version: PaymentVersion,
  settlement?: SettlementResponse
): Response => {
  const isSuccess = settlement?.success;
  const txHash = settlement?.transaction;

  return new Response(
    JSON.stringify({
      verified: true,
      payerAddress,
      version,
      settlement: settlement ? { success: isSuccess, txHash } : undefined,
    }),
    {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "X-Payment-Verified": "true",
        "X-Payer-Address": payerAddress,
        ...(settlement ? createSettlementHeaders(settlement, version) : {}),
      },
    },
  );
};

export const createRouteAwareBunMiddleware = (
  config: RouteAwareBunMiddlewareConfig
): BunMiddleware => {
  const { routes: resolvedRoutes, error: configError } = resolveRouteConfig(config);

  return async (request: Request): Promise<Response | null> => {
    if (configError) {
      return errorResponse(`Payment middleware configuration error: ${configError.message}`, 500);
    }

    const path = new URL(request.url).pathname;
    const matchedRoute = resolvedRoutes.find((r) => matchRoute(r.pattern, path));

    if (!matchedRoute) {
      return null;
    }

    const routeConfig = matchedRoute.config;
    const { facilitator, settlementMode = "verify", defaultVersion = 2, waitForSettlement = false } = routeConfig;

    const requirementsV1 = createPaymentRequirements(routeConfig, 1);
    const requirementsV2 = createPaymentRequirements(routeConfig, 2);

    const paymentResult = await parsePaymentHeader(request);

    if (!paymentResult) {
      const requirements = defaultVersion === 1 ? requirementsV1 : requirementsV2;
      return errorResponse("Payment required", 402, createPaymentRequiredHeaders(requirements, defaultVersion), [requirements]);
    }

    const { version, payerAddress } = paymentResult;

    if (facilitator) {
      const verifyResult = await verifyWithFacilitator(toHttpRequest(request), facilitator);
      if (!verifyResult.success) {
        const requirements = version === 1 ? requirementsV1 : requirementsV2;
        return errorResponse(`Payment verification failed: ${verifyResult.error}`, 402, createPaymentRequiredHeaders(requirements, version), [requirements]);
      }
    }

    if (settlementMode === "settle" && facilitator) {
      const settle = async () => {
        const result = await settleWithFacilitator(toHttpRequest(request), facilitator);
        return result.success
          ? successResponse(payerAddress, version, createSettlementResponse(true, result.txHash))
          : errorResponse(result.error ?? "Settlement failed", 400);
      };

      if (waitForSettlement) {
        return await settle();
      }
      settle().catch(console.error);
      return successResponse(payerAddress, version);
    }

    return successResponse(payerAddress, version);
  };
};
