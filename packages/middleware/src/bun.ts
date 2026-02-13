import type {
  X402PaymentPayload as PaymentPayload,
  X402SettlementResponse as SettlementResponse,
} from "@armory-sh/base";

type Network = "base" | "base-sepolia" | "ethereum" | "ethereum-sepolia" | "polygon" | "polygon-amoy" | "arbitrum" | "arbitrum-sepolia" | "optimism" | "optimism-sepolia" | string;
import { decodePayment, isExactEvmPayload, X402_HEADERS } from "@armory-sh/base";
import type { MiddlewareConfig, HttpRequest } from "./types.js";
import {
  createPaymentRequirements,
  verifyWithFacilitator,
  settleWithFacilitator,
  createPaymentRequiredHeaders,
  createSettlementHeaders,
} from "./core.js";
import {
  resolveMiddlewareConfig,
  getPrimaryConfig,
  type SimpleMiddlewareConfig,
} from "./simple.js";

export type BunMiddleware = (request: Request) => Promise<Response | null>;

export interface BunMiddlewareConfig extends MiddlewareConfig {
  defaultVersion?: 1 | 2;
  waitForSettlement?: boolean;
}

type PaymentVersion = 1 | 2;

type ParsedPayment = {
  payload: PaymentPayload;
  version: PaymentVersion;
  payerAddress: string;
};

const parsePaymentHeader = async (request: Request): Promise<ParsedPayment | null> => {
  // Check for x402 payment (Coinbase compatible)
  const x402Sig = request.headers.get(X402_HEADERS.PAYMENT);
  if (x402Sig) {
    try {
      const payload = decodePayment(x402Sig);
      if (isExactEvmPayload(payload)) {
        return { payload, version: 2, payerAddress: payload.payload.authorization.from };
      }
    } catch {
      // Fall through to legacy handling
    }
  }

  // Legacy V1 handling
  const v1 = request.headers.get("X-PAYMENT");
  if (v1) {
    try {
      const payload = decodePayment(v1);
      // x402 decoder handles both legacy and new formats
      if (isExactEvmPayload(payload)) {
        return { payload, version: 2, payerAddress: payload.payload.authorization.from };
      }
    } catch {
      // Invalid payload
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
  headers?: Record<string, string>
): Response =>
  new Response(JSON.stringify({ error }), {
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
  network: "base" as Network,
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
    }
  );
};

export const createBunMiddleware = (config: BunMiddlewareConfig): BunMiddleware => {
  const { facilitator, settlementMode = "verify", defaultVersion = 2, waitForSettlement = false } = config;
  const requirementsV1 = createPaymentRequirements(config, 1);
  const requirementsV2 = createPaymentRequirements(config, 2);

  return async (request: Request): Promise<Response | null> => {
    const paymentResult = await parsePaymentHeader(request);

    if (!paymentResult) {
      const requirements = defaultVersion === 1 ? requirementsV1 : requirementsV2;
      return errorResponse("Payment required", 402, createPaymentRequiredHeaders(requirements, defaultVersion));
    }

    const { version, payerAddress } = paymentResult;

    if (facilitator) {
      const verifyResult = await verifyWithFacilitator(toHttpRequest(request), facilitator);
      if (!verifyResult.success) {
        const requirements = version === 1 ? requirementsV1 : requirementsV2;
        return errorResponse(`Payment verification failed: ${verifyResult.error}`, 402, createPaymentRequiredHeaders(requirements, version));
      }
    }

    if (settlementMode === "settle" && facilitator) {
      const settle = async () => {
        const result = await settleWithFacilitator(toHttpRequest(request), facilitator);
        return result.success
          ? successResponse(payerAddress, version, createSettlementResponse(true, result.txHash))
          : errorResponse(result.error ?? "Settlement failed", 400);
      };

      return waitForSettlement ? await settle() : (settle().catch(console.error), successResponse(payerAddress, version));
    }

    return successResponse(payerAddress, version);
  };
};

/**
 * One-line middleware setup for accepting Armory payments
 *
 * @example
 * ```ts
 * // Simple usage - default USDC on Base
 * app.use(acceptPaymentsViaArmory({
 *   payTo: "0xMerchantAddress...",
 *   amount: "1.0"
 * }));
 *
 * // Multi-network, multi-token support
 * app.use(acceptPaymentsViaArmory({
 *   payTo: "0xMerchantAddress...",
 *   amount: "1.0",
 *   accept: {
 *     networks: ["base", "skale-base", "ethereum"],
 *     tokens: ["usdc", "eurc"],
 *     facilitators: [
 *       { url: "https://facilitator1.com" },
 *       { url: "https://facilitator2.com" }
 *     ]
 *   }
 * }));
 * ```
 */
export const acceptPaymentsViaArmory = (
  config: SimpleMiddlewareConfig & {
    defaultVersion?: 1 | 2;
    waitForSettlement?: boolean;
  }
): BunMiddleware => {
  // Resolve the simple config to full config
  const resolved = resolveMiddlewareConfig(config);

  if ("code" in resolved) {
    throw new Error(`Invalid payment configuration: ${resolved.message}`);
  }

  // Get primary config for legacy middleware
  const primaryConfig = getPrimaryConfig(resolved);

  // Create middleware with primary config
  return createBunMiddleware({
    ...primaryConfig,
    defaultVersion: config.defaultVersion ?? 2,
    waitForSettlement: config.waitForSettlement ?? false,
  });
};
