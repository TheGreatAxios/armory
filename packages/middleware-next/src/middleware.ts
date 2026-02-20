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
  enrichPaymentRequirements,
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
import type { NextRequest, NextResponse } from "next/server";
import type { x402ResourceServer } from "./resource-server";

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
  amounts?: Record<string, string>;
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
    const requirements = Array.isArray(config.requirements)
      ? config.requirements
      : [config.requirements];
    return {
      requirements: enrichPaymentRequirements(requirements),
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

export function paymentMiddleware(config: PaymentConfig) {
  const { requirements, error } = createPaymentRequirements(config);
  const resolvePaymentRequiredHeaders = async () =>
    createPaymentRequiredHeaders(requirements, {
      extensions: await resolvePaymentRequiredExtensions(
        config,
        requirements,
      ),
    });

  return async (request: NextRequest): Promise<NextResponse> => {
    if (error) {
      return NextResponse.json(
        {
          error: "Payment middleware configuration error",
          details: error.message,
        },
        { status: 500 },
      );
    }

    const primaryRequirement = requirements[0];
    if (!primaryRequirement) {
      return NextResponse.json(
        {
          error: "Payment middleware configuration error",
          message: "No payment requirements configured",
        },
        { status: 500 },
      );
    }

    const paymentHeader = request.headers.get(PAYMENT_SIGNATURE_HEADER);

    if (!paymentHeader) {
      const requiredHeaders = await resolvePaymentRequiredHeaders();
      return NextResponse.json(
        { error: "Payment required", accepts: requirements },
        {
          status: 402,
          headers: requiredHeaders,
        },
      );
    }

    let paymentPayload: X402PaymentPayload;
    try {
      paymentPayload = decodePayloadHeader(paymentHeader, {
        accepted: primaryRequirement,
      });
    } catch {
      return NextResponse.json(
        { error: "Invalid payment payload" },
        { status: 400 },
      );
    }

    const selectedRequirement = findRequirementByAccepted(
      requirements,
      paymentPayload.accepted,
    );
    if (!selectedRequirement) {
      return NextResponse.json(
        {
          error: "Invalid payment payload",
          message: "Accepted requirement is not configured for this endpoint",
        },
        { status: 400 },
      );
    }

    const facilitatorUrl = resolveFacilitatorUrlFromRequirement(
      config,
      selectedRequirement,
    );

    if (!facilitatorUrl) {
      return NextResponse.json(
        {
          error: "Payment middleware configuration error",
          message: "Facilitator URL is required for verification",
        },
        { status: 500 },
      );
    }

    const verifyResult: VerifyResponse = await verifyPayment(
      paymentPayload,
      selectedRequirement,
      { url: facilitatorUrl },
    );

    if (!verifyResult.isValid) {
      const requiredHeaders = await resolvePaymentRequiredHeaders();
      return NextResponse.json(
        {
          error: "Payment verification failed",
          message: verifyResult.invalidReason,
        },
        {
          status: 402,
          headers: requiredHeaders,
        },
      );
    }

    const payerAddress =
      verifyResult.payer ?? paymentPayload.payload.authorization.from;

    const settleResult: X402SettlementResponse = await settlePayment(
      paymentPayload,
      selectedRequirement,
      { url: facilitatorUrl },
    );

    if (!settleResult.success) {
      return NextResponse.json(
        { error: "Settlement failed", details: settleResult.errorReason },
        { status: 502 },
      );
    }

    return NextResponse.json(
      {
        verified: true,
        payerAddress,
        settlement: { success: true, txHash: settleResult.transaction },
      },
      {
        status: 200,
        headers: {
          "X-Payment-Verified": "true",
          "X-Payer-Address": payerAddress,
          ...createSettlementHeaders(settleResult),
        },
      },
    );
  };
}

export type {
  HTTPFacilitatorClient,
  MiddlewareConfig,
  PaymentScheme,
  RoutePaymentConfig,
} from "./types";
export function createMiddleware(
  routes: Record<string, RoutePaymentConfig>,
  resourceServer: x402ResourceServer,
): (request: NextRequest) => Promise<NextResponse> {
  const { paymentProxy } = require("./proxy");
  const proxy = paymentProxy(routes, resourceServer);

  return async (request: NextRequest): Promise<NextResponse> => {
    const response = await proxy(request);
    const body = await response.text();
    return new NextResponse(body, {
      status: response.status,
      headers: response.headers,
    });
  };
}
