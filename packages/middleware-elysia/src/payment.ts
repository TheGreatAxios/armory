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
  isValidationError,
  PAYMENT_SIGNATURE_HEADER,
  registerToken,
  resolveNetwork,
  resolveToken,
  settlePayment,
  TOKENS,
  verifyPayment,
} from "@armory-sh/base";
import { Elysia } from "elysia";

type NetworkId = string | number;
type TokenId = string;

export interface PaymentConfig {
  payTo: string;
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
  ensureTokensRegistered();
  return createBasePaymentRequirements(config);
}

const errorResponse = (
  error: string | Record<string, unknown>,
  status: number,
  headers?: Record<string, string>,
): Response =>
  new Response(JSON.stringify(error), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });

export const paymentMiddleware = (config: PaymentConfig) => {
  const { requirements, error } = createPaymentRequirements(config);

  return new Elysia({ name: "armory-payment" })
    .derive(() => ({
      payment: undefined as
        | {
            payload: X402PaymentPayload;
            payerAddress: string;
            verified: boolean;
          }
        | undefined,
    }))
    .onBeforeHandle(async (context) => {
      if (error) {
        return errorResponse(
          {
            error: "Payment middleware configuration error",
            details: error.message,
          },
          500,
        );
      }

      const primaryRequirement = requirements[0];
      if (!primaryRequirement) {
        return errorResponse(
          {
            error: "Payment middleware configuration error",
            message: "No payment requirements configured",
          },
          500,
        );
      }

      const paymentHeader = context.request.headers.get(
        PAYMENT_SIGNATURE_HEADER,
      );

      if (!paymentHeader) {
        return errorResponse(
          { error: "Payment required", accepts: requirements },
          402,
          createPaymentRequiredHeaders(requirements),
        );
      }

      let paymentPayload: X402PaymentPayload;
      try {
        paymentPayload = decodePayloadHeader(paymentHeader, {
          accepted: primaryRequirement,
        });
      } catch (err) {
        return errorResponse(
          {
            error: "Invalid payment payload",
            message: err instanceof Error ? err.message : "Unknown error",
          },
          400,
        );
      }

      const facilitatorUrl = resolveFacilitatorUrlFromRequirement(
        config,
        primaryRequirement,
      );

      if (!facilitatorUrl) {
        return errorResponse(
          {
            error: "Payment middleware configuration error",
            message: "Facilitator URL is required for verification",
          },
          500,
        );
      }

      const verifyResult: VerifyResponse = await verifyPayment(
        paymentPayload,
        primaryRequirement,
        { url: facilitatorUrl },
      );

      if (!verifyResult.isValid) {
        return errorResponse(
          {
            error: "Payment verification failed",
            message: verifyResult.invalidReason,
          },
          402,
          createPaymentRequiredHeaders(requirements),
        );
      }

      const payerAddress =
        verifyResult.payer ?? paymentPayload.payload.authorization.from;
      (
        context as {
          payment?: {
            payload: X402PaymentPayload;
            payerAddress: string;
            verified: boolean;
          };
        }
      ).payment = { payload: paymentPayload, payerAddress, verified: true };
    })
    .onAfterHandle(async (context) => {
      const payment = context.payment;
      if (!payment) {
        return;
      }

      const statusCode =
        typeof context.set.status === "number" ? context.set.status : 200;
      if (statusCode >= 400) {
        return;
      }

      const primaryRequirement = requirements[0];
      if (!primaryRequirement) {
        return errorResponse(
          {
            error: "Payment middleware configuration error",
            message: "No payment requirements configured",
          },
          500,
        );
      }

      const facilitatorUrl = resolveFacilitatorUrlFromRequirement(
        config,
        primaryRequirement,
      );

      if (!facilitatorUrl) {
        return errorResponse(
          {
            error: "Payment middleware configuration error",
            message: "Facilitator URL is required for settlement",
          },
          500,
        );
      }

      const settleResult: X402SettlementResponse = await settlePayment(
        payment.payload,
        primaryRequirement,
        { url: facilitatorUrl },
      );

      if (!settleResult.success) {
        return errorResponse(
          { error: "Settlement failed", details: settleResult.errorReason },
          502,
        );
      }

      return {
        headers: createSettlementHeaders(settleResult),
      };
    });
};
