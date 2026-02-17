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
import type { NextRequest, NextResponse } from "next/server";
import type { x402ResourceServer } from "./resource-server";

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

export function paymentMiddleware(config: PaymentConfig) {
  const { requirements, error } = createPaymentRequirements(config);

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
      return NextResponse.json(
        { error: "Payment required", accepts: requirements },
        {
          status: 402,
          headers: createPaymentRequiredHeaders(requirements),
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

    const facilitatorUrl = resolveFacilitatorUrlFromRequirement(
      config,
      primaryRequirement,
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
      primaryRequirement,
      { url: facilitatorUrl },
    );

    if (!verifyResult.isValid) {
      return NextResponse.json(
        {
          error: "Payment verification failed",
          message: verifyResult.invalidReason,
        },
        {
          status: 402,
          headers: createPaymentRequiredHeaders(requirements),
        },
      );
    }

    const payerAddress =
      verifyResult.payer ?? paymentPayload.payload.authorization.from;

    const settleResult: X402SettlementResponse = await settlePayment(
      paymentPayload,
      primaryRequirement,
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
