import type { Context, Next } from "hono";
import type {
  PaymentRequirementsV2,
  PaymentRequiredV2,
  ResourceInfo,
  X402PaymentPayload,
  VerifyResponse,
  X402SettlementResponse,
} from "@armory-sh/base";
import {
  safeBase64Encode,
  V2_HEADERS,
  matchRoute,
  validateRouteConfig,
  createPaymentRequiredHeaders,
  createSettlementHeaders,
  decodePayloadHeader,
  verifyPayment,
  settlePayment,
} from "@armory-sh/base";
import type { PaymentConfig } from "./simple";
import { createPaymentRequirements } from "./simple";

interface LocalValidationError {
  code: string;
  message: string;
  path?: string;
  value?: unknown;
  validOptions?: string[];
}

export interface RouteAwarePaymentConfig extends PaymentConfig {
  route?: string;
  routes?: string[];
  perRoute?: Record<string, Partial<PaymentConfig>>;
}

interface ResolvedRouteConfig {
  pattern: string;
  config: PaymentConfig;
}

const resolveRouteConfig = (
  config: RouteAwarePaymentConfig
): { routes: ResolvedRouteConfig[]; error?: LocalValidationError } => {
  const validationError = validateRouteConfig(config);
  if (validationError) {
    return { routes: [], error: validationError };
  }

  const { route, routes, perRoute, ...baseConfig } = config;
  const routePatterns = route ? [route] : routes || [];

  const resolvedRoutes: ResolvedRouteConfig[] = [];

  for (const pattern of routePatterns) {
    const perRouteOverride = perRoute?.[pattern];
    const mergedConfig: PaymentConfig = {
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

export const routeAwarePaymentMiddleware = (
  config: RouteAwarePaymentConfig
) => {
  const { routes, error } = resolveRouteConfig(config);

  return async (c: Context, next: Next): Promise<Response | void> => {
    if (error) {
      c.status(500);
      return c.json({
        error: "Payment middleware configuration error",
        details: error.message,
      });
    }

    const path = new URL(c.req.url).pathname;
    const matchedRoute = routes.find((r) => matchRoute(r.pattern, path));

    if (!matchedRoute) {
      return next();
    }

    const { requirements, error: requirementsError } =
      createPaymentRequirements(matchedRoute.config);

    if (requirementsError) {
      c.status(500);
      return c.json({
        error: "Payment middleware configuration error",
        details: requirementsError.message,
      });
    }

    const paymentHeader = c.req.header(V2_HEADERS.PAYMENT_SIGNATURE);

    if (!paymentHeader) {
      const resource: ResourceInfo = {
        url: c.req.url,
        description: "API Access",
        mimeType: "application/json",
      };

      const paymentRequired: PaymentRequiredV2 = {
        x402Version: 2,
        error: "Payment required",
        resource,
        accepts: requirements,
      };

      c.status(402);
      c.header(
        V2_HEADERS.PAYMENT_REQUIRED,
        safeBase64Encode(JSON.stringify(paymentRequired))
      );
      return c.json({
        error: "Payment required",
        accepts: requirements,
      });
    }

    const primaryRequirement = requirements[0];
    if (!primaryRequirement) {
      c.status(500);
      return c.json({ error: "Payment middleware configuration error", details: "No payment requirements configured" });
    }

    let parsedPayload: X402PaymentPayload;
    try {
      parsedPayload = decodePayloadHeader(paymentHeader, {
        accepted: primaryRequirement,
      });
    } catch {
      c.status(400);
      return c.json({ error: "Invalid payment payload" });
    }

    const requirementFacilitatorUrl = primaryRequirement.extra?.facilitatorUrl;
    const facilitatorUrl = matchedRoute.config.facilitatorUrl
      ?? (typeof requirementFacilitatorUrl === "string" ? requirementFacilitatorUrl : undefined);

    if (!facilitatorUrl) {
      c.status(500);
      return c.json({ error: "Payment middleware configuration error", message: "Facilitator URL is required for verification" });
    }

    const verifyResult: VerifyResponse = await verifyPayment(parsedPayload, primaryRequirement, { url: facilitatorUrl });

    if (!verifyResult.isValid) {
      c.status(402);
      c.header(V2_HEADERS.PAYMENT_REQUIRED, createPaymentRequiredHeaders(requirements)[V2_HEADERS.PAYMENT_REQUIRED]);
      return c.json({ error: "Payment verification failed", message: verifyResult.invalidReason });
    }

    c.set("payment", {
      payload: parsedPayload,
      payerAddress: verifyResult.payer,
      verified: true,
      route: matchedRoute.pattern,
    });

    await next();

    if (c.res.status >= 400) {
      return;
    }

    const settleResult: X402SettlementResponse = await settlePayment(parsedPayload, primaryRequirement, { url: facilitatorUrl });

    if (!settleResult.success) {
      c.status(502);
      c.res = c.json({ error: "Settlement failed", details: settleResult.errorReason }, 502);
      return;
    }

    const headers = createSettlementHeaders(settleResult);
    for (const [key, value] of Object.entries(headers)) {
      c.header(key, value);
    }
  };
};
