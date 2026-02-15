import type {
  X402PaymentPayload as PaymentPayload,
  X402SettlementResponse as SettlementResponse,
  X402Network,
} from "@armory-sh/base";
import { decodePayment, isExactEvmPayload } from "@armory-sh/base";
import type { MiddlewareConfig, HttpRequest } from "./types";
import {
  createPaymentRequirements,
  verifyWithFacilitator,
  settleWithFacilitator,
  createPaymentRequiredHeaders,
  createSettlementHeaders,
} from "./core";

export type BunMiddleware = (request: Request) => Promise<Response | null>;
export type BunHandler = (request: Request) => Promise<Response> | Response;

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
  const paymentSig = request.headers.get("PAYMENT-SIGNATURE");
  if (paymentSig) {
    try {
      const payload = decodePayment(paymentSig);
      if (isExactEvmPayload(payload.payload)) {
        return { payload: payload as PaymentPayload, version: 2, payerAddress: payload.payload.authorization.from };
      }
    } catch {
    }
  }

  const xPayment = request.headers.get("X-PAYMENT");
  if (xPayment) {
    try {
      const payload = decodePayment(xPayment);
      if (isExactEvmPayload(payload.payload)) {
        return { payload: payload as PaymentPayload, version: 2, payerAddress: payload.payload.authorization.from };
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

const appendSettlementHeaders = (
  response: Response,
  settlement: SettlementResponse,
  version: PaymentVersion
): Response => {
  const headers = new Headers(response.headers);
  const settlementHeaders = createSettlementHeaders(settlement, version);
  for (const [key, value] of Object.entries(settlementHeaders)) {
    headers.set(key, value);
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
};

export const createBunMiddleware = (
  config: BunMiddlewareConfig,
  handler?: BunHandler
): BunMiddleware | ((request: Request) => Promise<Response>) => {
  const { facilitator, settlementMode = "settle", defaultVersion = 2, waitForSettlement = false } = config;

  const requirementsV1 = createPaymentRequirements(config, 1);
  const requirementsV2 = createPaymentRequirements(config, 2);

  const middleware = async (request: Request): Promise<Response | null> => {
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

    if (!handler) {
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
    }

    const response = await handler(request);

    if (response.status >= 400 || settlementMode !== "settle" || !facilitator) {
      return response;
    }

    const settleResult = await settleWithFacilitator(toHttpRequest(request), facilitator);
    if (!settleResult.success) {
      return errorResponse(settleResult.error ?? "Settlement failed", 502);
    }

    const settlement = createSettlementResponse(true, settleResult.txHash);
    return appendSettlementHeaders(response, settlement, version);
  };

  if (!handler) {
    return middleware;
  }

  return async (request: Request): Promise<Response> => {
    const result = await middleware(request);
    if (!result) {
      return errorResponse("Payment middleware returned no response", 500);
    }
    return result;
  };
};

export { createRouteAwareBunMiddleware, type RouteAwareBunMiddlewareConfig } from "./routes";
