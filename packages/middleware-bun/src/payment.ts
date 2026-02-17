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
  extractPayerAddress,
  isValidationError,
  PAYMENT_SIGNATURE_HEADER,
  registerToken,
  resolveNetwork,
  resolveToken,
  settlePayment,
  TOKENS,
  verifyPayment,
} from "@armory-sh/base";

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

export type BunMiddleware = (request: Request) => Promise<Response | null>;
export type BunHandler = (request: Request) => Promise<Response> | Response;

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
  error: string,
  status: number,
  headers?: Record<string, string>,
  accepts?: unknown[],
): Response =>
  new Response(JSON.stringify({ error, accepts }), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });

const successResponse = (
  payerAddress: string,
  settlement?: X402SettlementResponse,
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
  settlement: X402SettlementResponse,
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

export const paymentMiddleware = (
  config: PaymentConfig,
  handler?: BunHandler,
): BunMiddleware => {
  const { requirements, error } = createPaymentRequirements(config);

  return async (request: Request): Promise<Response> => {
    if (error) {
      return errorResponse(
        "Payment middleware configuration error",
        500,
        undefined,
        [error.message],
      );
    }

    const primaryRequirement = requirements[0];
    if (!primaryRequirement) {
      return errorResponse(
        "Payment middleware configuration error: No payment requirements configured",
        500,
      );
    }

    const paymentSig = request.headers.get(PAYMENT_SIGNATURE_HEADER);
    if (!paymentSig) {
      return errorResponse(
        "Payment required",
        402,
        createPaymentRequiredHeaders(requirements),
        [requirements],
      );
    }

    let payload: X402PaymentPayload;
    try {
      payload = decodePayloadHeader(paymentSig, {
        accepted: primaryRequirement,
      });
    } catch {
      return errorResponse("Invalid payment payload", 400);
    }

    const facilitatorUrl = resolveFacilitatorUrlFromRequirement(
      config,
      primaryRequirement,
    );
    if (!facilitatorUrl) {
      return errorResponse(
        "Payment middleware configuration error: Facilitator URL is required",
        500,
      );
    }

    const verifyResult: VerifyResponse = await verifyPayment(
      payload,
      primaryRequirement,
      { url: facilitatorUrl },
    );
    if (!verifyResult.isValid) {
      return errorResponse(
        `Payment verification failed: ${verifyResult.invalidReason}`,
        402,
        createPaymentRequiredHeaders(requirements),
      );
    }

    const payerAddress = verifyResult.payer ?? extractPayerAddress(payload);

    if (!handler) {
      return successResponse(payerAddress);
    }

    const response = await handler(request);

    if (response.status >= 400) {
      return response;
    }

    const settleResult: X402SettlementResponse = await settlePayment(
      payload,
      primaryRequirement,
      { url: facilitatorUrl },
    );
    if (!settleResult.success) {
      return errorResponse(
        settleResult.errorReason ?? "Settlement failed",
        502,
      );
    }

    return appendSettlementHeaders(response, settleResult);
  };
};
