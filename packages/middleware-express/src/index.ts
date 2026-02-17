import type {
  PaymentRequirementsV2,
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
  PAYMENT_SIGNATURE_HEADER,
  registerToken,
  resolveNetwork,
  resolveToken,
  settlePayment,
  TOKENS,
  verifyPayment,
} from "@armory-sh/base";
import type { NextFunction, Request, Response } from "express";

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

export interface AugmentedRequest extends Request {
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

const installSettlementHook = (
  res: Response,
  settle: () => Promise<X402SettlementResponse>,
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
          end(
            JSON.stringify({
              error: "Settlement failed",
              details: settlement.errorReason,
            }),
          );
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

const sendError = (
  res: Response,
  status: number,
  headers: Record<string, string>,
  body: unknown,
): void => {
  res.status(status);
  Object.entries(headers).forEach(([k, v]) => {
    res.setHeader(k, v);
  });
  res.json(body);
};

export const paymentMiddleware = (config: PaymentConfig) => {
  const { requirements, error } = createPaymentRequirements(config);

  return async (
    req: AugmentedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    if (error) {
      sendError(
        res,
        500,
        {},
        {
          error: "Payment middleware configuration error",
          details: error.message,
        },
      );
      return;
    }

    const primaryRequirement = requirements[0];
    if (!primaryRequirement) {
      sendError(
        res,
        500,
        {},
        {
          error: "Payment middleware configuration error",
          message: "No payment requirements configured",
        },
      );
      return;
    }

    const paymentHeader = req.headers[PAYMENT_SIGNATURE_HEADER.toLowerCase()] as
      | string
      | undefined;

    if (!paymentHeader) {
      const requiredHeaders = createPaymentRequiredHeaders(requirements);
      sendError(res, 402, requiredHeaders, {
        error: "Payment required",
        accepts: requirements,
      });
      return;
    }

    let paymentPayload: X402PaymentPayload;
    try {
      paymentPayload = decodePayloadHeader(paymentHeader, {
        accepted: primaryRequirement,
      });
    } catch (err) {
      sendError(
        res,
        400,
        {},
        {
          error: "Invalid payment payload",
          message: err instanceof Error ? err.message : "Unknown error",
        },
      );
      return;
    }

    const selectedRequirement = findRequirementByAccepted(
      requirements,
      paymentPayload.accepted,
    );
    if (!selectedRequirement) {
      sendError(
        res,
        400,
        {},
        {
          error: "Invalid payment payload",
          message: "Accepted requirement is not configured for this endpoint",
        },
      );
      return;
    }

    const facilitatorUrl = resolveFacilitatorUrlFromRequirement(
      config,
      selectedRequirement,
    );

    if (!facilitatorUrl) {
      sendError(
        res,
        500,
        {},
        {
          error: "Payment middleware configuration error",
          message: "Facilitator URL is required for verification",
        },
      );
      return;
    }

    const verifyResult: VerifyResponse = await verifyPayment(
      paymentPayload,
      selectedRequirement,
      { url: facilitatorUrl },
    );

    if (!verifyResult.isValid) {
      const requiredHeaders = createPaymentRequiredHeaders(requirements);
      sendError(res, 402, requiredHeaders, {
        error: "Payment verification failed",
        message: verifyResult.invalidReason,
      });
      return;
    }

    const payerAddress =
      verifyResult.payer ?? paymentPayload.payload.authorization.from;

    req.payment = { payload: paymentPayload, payerAddress, verified: true };

    installSettlementHook(res, async () =>
      settlePayment(paymentPayload, selectedRequirement, {
        url: facilitatorUrl,
      }),
    );

    next();
  };
};

export {
  type PaymentMiddlewareConfigEntry,
  type RouteAwarePaymentMiddlewareConfig,
  routeAwarePaymentMiddleware,
} from "./routes";
