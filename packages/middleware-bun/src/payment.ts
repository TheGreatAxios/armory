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
  findRequirementByAccepted,
  getSupported,
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
type CapabilityCacheEntry = { expiresAt: number; keys: Set<string> };

const extensionCapabilityCache = new Map<string, CapabilityCacheEntry>();
const EXTENSION_CAPABILITY_TTL_MS = 5 * 60 * 1000;

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
  extensions?: Record<string, unknown>;
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
        isValidationError(resolvedChain) ||
        resolvedChain.config.chainId !== chainId
      ) {
        continue;
      }

      for (const [tokenKey, url] of Object.entries(tokenMap)) {
        const resolvedToken = resolveToken(tokenKey, resolvedChain);
        if (
          !isValidationError(resolvedToken) &&
          resolvedToken.config.contractAddress.toLowerCase() === assetAddress
        ) {
          return url;
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

async function resolvePaymentRequiredExtensions(
  config: PaymentConfig,
  requirements: PaymentRequirementsV2[],
): Promise<Record<string, unknown>> {
  if (!config.extensions) {
    return {};
  }

  let filtered: Record<string, unknown> = { ...config.extensions };
  for (const requirement of requirements) {
    const facilitatorUrl = resolveFacilitatorUrlFromRequirement(config, requirement);
    if (!facilitatorUrl) {
      continue;
    }

    const cacheKey = `${facilitatorUrl}|${requirement.network.toLowerCase()}`;
    const now = Date.now();
    let keys = extensionCapabilityCache.get(cacheKey);
    if (!keys || keys.expiresAt <= now) {
      try {
        const supported = await getSupported({ url: facilitatorUrl });
        const nextKeys = new Set<string>();
        for (const kind of supported.kinds) {
          if (kind.network.toLowerCase() !== requirement.network.toLowerCase()) {
            continue;
          }
          if (kind.extra && typeof kind.extra === "object") {
            for (const key of Object.keys(kind.extra)) {
              nextKeys.add(key);
            }
          }
        }
        keys = { expiresAt: now + EXTENSION_CAPABILITY_TTL_MS, keys: nextKeys };
      } catch {
        keys = { expiresAt: now + EXTENSION_CAPABILITY_TTL_MS, keys: new Set() };
      }
      extensionCapabilityCache.set(cacheKey, keys);
    }

    filtered = Object.fromEntries(
      Object.entries(filtered).filter(([key]) => keys.keys.has(key)),
    );
    if (Object.keys(filtered).length === 0) {
      return {};
    }
  }

  return filtered;
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
  const resolvePaymentRequiredHeaders = async () =>
    createPaymentRequiredHeaders(requirements, {
      extensions: await resolvePaymentRequiredExtensions(
        config,
        requirements,
      ),
    });

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
      const requiredHeaders = await resolvePaymentRequiredHeaders();
      return errorResponse(
        "Payment required",
        402,
        requiredHeaders,
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

    const selectedRequirement = findRequirementByAccepted(
      requirements,
      payload.accepted,
    );
    if (!selectedRequirement) {
      return errorResponse(
        "Invalid payment payload: accepted requirement is not configured for this endpoint",
        400,
      );
    }

    const facilitatorUrl = resolveFacilitatorUrlFromRequirement(
      config,
      selectedRequirement,
    );
    if (!facilitatorUrl) {
      return errorResponse(
        "Payment middleware configuration error: Facilitator URL is required",
        500,
      );
    }

    const verifyResult: VerifyResponse = await verifyPayment(
      payload,
      selectedRequirement,
      { url: facilitatorUrl },
    );
    if (!verifyResult.isValid) {
      const requiredHeaders = await resolvePaymentRequiredHeaders();
      return errorResponse(
        `Payment verification failed: ${verifyResult.invalidReason}`,
        402,
        requiredHeaders,
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
      selectedRequirement,
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
