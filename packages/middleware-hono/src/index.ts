import type {
  PaymentRequiredV2,
  PaymentRequirementsV2,
  ResourceInfo,
  VerifyResponse,
  X402PaymentPayload,
  X402SettlementResponse,
} from "@armory-sh/base";
import {
  createPaymentRequirements as createBasePaymentRequirements,
  createPaymentRequiredHeaders,
  createSettlementHeaders,
  decodePayloadHeader,
  findRequirementByAccepted,
  isValidationError,
  PAYMENT_REQUIRED_HEADER,
  PAYMENT_SIGNATURE_HEADER,
  registerToken,
  resolveNetwork,
  resolveToken,
  safeBase64Encode,
  settlePayment,
  TOKENS,
  verifyPayment,
} from "@armory-sh/base";
import type { Context, Next } from "hono";

type NetworkId = string | number;
type TokenId = string;

export interface PaymentConfig {
  payTo?: string;
  requirements?: PaymentRequirementsV2 | PaymentRequirementsV2[];
  chains?: NetworkId[];
  chain?: NetworkId;
  tokens?: TokenId[];
  token?: TokenId;
  amount?: string;
  maxTimeoutSeconds?: number;
  facilitatorUrl?: string;
  facilitatorUrlByChain?: Record<string, string>;
  facilitatorUrlByToken?: Record<string, Record<string, string>>;
}

export interface ResolvedRequirementsConfig {
  requirements: PaymentRequirementsV2[];
  error?: { code: string; message: string };
}

export interface AugmentedContext extends Context {
  payment?: {
    payload: X402PaymentPayload;
    payerAddress: string;
    verified: boolean;
  };
}

function ensureTokensRegistered() {
  for (const token of Object.values(TOKENS)) {
    try {
      registerToken(token);
    } catch {}
  }
}

export function resolveFacilitatorUrlFromRequirement(
  config: PaymentConfig,
  requirement: PaymentRequirementsV2,
): string | undefined {
  const chainId = parseInt(requirement.network.split(":")[1] || "0", 10);
  const assetAddress = requirement.asset.toLowerCase();

  if (config.facilitatorUrlByToken) {
    for (const [chainKey, tokenMap] of Object.entries(
      config.facilitatorUrlByToken,
    )) {
      const resolvedChain = resolveNetwork(chainKey);
      if (
        !isValidationError(resolvedChain) &&
        resolvedChain.config.chainId === chainId
      ) {
        for (const [, url] of Object.entries(tokenMap)) {
          const network = resolveNetwork(chainKey);
          if (!isValidationError(network)) {
            for (const tokenKey of Object.keys(tokenMap)) {
              const resolvedToken = resolveToken(tokenKey, network);
              if (
                !isValidationError(resolvedToken) &&
                resolvedToken.config.contractAddress.toLowerCase() ===
                  assetAddress
              ) {
                return url;
              }
            }
          }
        }
      }
    }
  }

  if (config.facilitatorUrlByChain) {
    for (const [chainKey, url] of Object.entries(
      config.facilitatorUrlByChain,
    )) {
      const resolvedChain = resolveNetwork(chainKey);
      if (
        !isValidationError(resolvedChain) &&
        resolvedChain.config.chainId === chainId
      ) {
        return url;
      }
    }
  }

  return config.facilitatorUrl;
}

export function createPaymentRequirements(
  config: PaymentConfig,
): ResolvedRequirementsConfig {
  if (config.requirements) {
    return {
      requirements: Array.isArray(config.requirements)
        ? config.requirements
        : [config.requirements],
    };
  }

  if (!config.payTo) {
    return {
      requirements: [],
      error: {
        code: "VALIDATION_FAILED",
        message:
          "Missing payment configuration: provide payTo or explicit requirements",
      },
    };
  }

  ensureTokensRegistered();
  return createBasePaymentRequirements(config as PaymentConfig & { payTo: string });
}

export function paymentMiddleware(config: PaymentConfig) {
  const { requirements, error } = createPaymentRequirements(config);

  return async (c: Context, next: Next): Promise<Response | undefined> => {
    if (error) {
      c.status(500);
      return c.json({
        error: "Payment middleware configuration error",
        details: error.message,
      });
    }

    const primaryRequirement = requirements[0];
    if (!primaryRequirement) {
      c.status(500);
      return c.json({
        error: "Payment middleware configuration error",
        details: "No payment requirements configured",
      });
    }

    const paymentHeader = c.req.header(PAYMENT_SIGNATURE_HEADER);

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
        PAYMENT_REQUIRED_HEADER,
        safeBase64Encode(JSON.stringify(paymentRequired)),
      );
      return c.json({
        error: "Payment required",
        accepts: requirements,
      });
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

    const selectedRequirement = findRequirementByAccepted(
      requirements,
      parsedPayload.accepted,
    );
    if (!selectedRequirement) {
      c.status(400);
      return c.json({
        error: "Invalid payment payload",
        message: "Accepted requirement is not configured for this endpoint",
      });
    }

    const facilitatorUrl = resolveFacilitatorUrlFromRequirement(
      config,
      selectedRequirement,
    );

    if (!facilitatorUrl) {
      c.status(500);
      return c.json({
        error: "Payment middleware configuration error",
        message: "Facilitator URL is required for verification",
      });
    }

    const verifyResult: VerifyResponse = await verifyPayment(
      parsedPayload,
      selectedRequirement,
      { url: facilitatorUrl },
    );

    if (!verifyResult.isValid) {
      c.status(402);
      c.header(
        PAYMENT_REQUIRED_HEADER,
        createPaymentRequiredHeaders(requirements)[PAYMENT_REQUIRED_HEADER],
      );
      return c.json({
        error: "Payment verification failed",
        message: verifyResult.invalidReason,
      });
    }

    c.set("payment", {
      payload: parsedPayload,
      payerAddress: verifyResult.payer,
      verified: true,
    });

    await next();

    if (c.res.status >= 400) {
      return;
    }

    const settleResult: X402SettlementResponse = await settlePayment(
      parsedPayload,
      selectedRequirement,
      { url: facilitatorUrl },
    );

    if (!settleResult.success) {
      c.status(502);
      c.res = c.json(
        { error: "Settlement failed", details: settleResult.errorReason },
        502,
      );
      return;
    }

    const headers = createSettlementHeaders(settleResult);
    for (const [key, value] of Object.entries(headers)) {
      c.header(key, value);
    }
  };
}

export {
  buildExtensions,
  type ExtensionConfig,
  extractExtension,
} from "./extensions";
export {
  type RouteAwarePaymentConfig,
  routeAwarePaymentMiddleware,
} from "./routes";
