import type {
  X402PaymentPayload,
  X402SettlementResponse,
  X402Network,
  PaymentRequirements,
  VerifyResponse,
} from "@armory-sh/base";
import { decodePayloadHeader, extractPayerAddress, verifyPayment, settlePayment, createPaymentRequiredHeaders, createSettlementHeaders, PAYMENT_SIGNATURE_HEADER } from "@armory-sh/base";
import type { MiddlewareConfig } from "./types";
import { createPaymentRequirements } from "./core";

export type BunMiddleware = (request: Request) => Promise<Response | null>;
export type BunHandler = (request: Request) => Promise<Response> | Response;

export interface BunMiddlewareConfig extends MiddlewareConfig {
  waitForSettlement?: boolean;
}

type ParsedPayment = {
  payload: X402PaymentPayload;
  payerAddress: string;
};

const parsePaymentHeader = async (request: Request, requirements: PaymentRequirements): Promise<ParsedPayment | null> => {
  const paymentSig = request.headers.get(PAYMENT_SIGNATURE_HEADER);
  if (paymentSig) {
    try {
      const payload = decodePayloadHeader(paymentSig, { accepted: requirements });
      return { payload, payerAddress: extractPayerAddress(payload) };
    } catch {
    }
  }

  return null;
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
): X402SettlementResponse => ({
  success,
  transaction: txHash ?? "",
  errorReason: success ? undefined : "Settlement failed",
  network: "base" as X402Network,
});

const successResponse = (
  payerAddress: string,
  settlement?: X402SettlementResponse
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
  settlement: X402SettlementResponse
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

export const createBunMiddleware = (
  config: BunMiddlewareConfig,
  handler?: BunHandler
): BunMiddleware | ((request: Request) => Promise<Response>) => {
  const { facilitator, settlementMode = "settle", waitForSettlement = false } = config;
  const requirements = createPaymentRequirements(config);

  const middleware = async (request: Request): Promise<Response | null> => {
    const paymentResult = await parsePaymentHeader(request, requirements);

    if (!paymentResult) {
      return errorResponse("Payment required", 402, createPaymentRequiredHeaders(requirements), [requirements]);
    }

    const { payerAddress, payload } = paymentResult;

    if (facilitator) {
      const verifyResult: VerifyResponse = await verifyPayment(payload, requirements, { url: facilitator.url });
      if (!verifyResult.isValid) {
        return errorResponse(`Payment verification failed: ${verifyResult.invalidReason}`, 402, createPaymentRequiredHeaders(requirements), [requirements]);
      }
    }

    if (!handler) {
      if (settlementMode === "settle" && facilitator) {
        const settle = async () => {
          const result = await settlePayment(payload, requirements, { url: facilitator.url });
          return result.success
            ? successResponse(payerAddress, createSettlementResponse(true, result.transaction))
            : errorResponse(result.errorReason ?? "Settlement failed", 400);
        };

        if (waitForSettlement) {
          return await settle();
        }
        settle().catch(console.error);
        return successResponse(payerAddress);
      }

      return successResponse(payerAddress);
    }

    const response = await handler(request);

    if (response.status >= 400 || settlementMode !== "settle" || !facilitator) {
      return response;
    }

    const settleResult = await settlePayment(payload, requirements, { url: facilitator.url });
    if (!settleResult.success) {
      return errorResponse(settleResult.errorReason ?? "Settlement failed", 502);
    }

    const settlement = createSettlementResponse(true, settleResult.transaction);
    return appendSettlementHeaders(response, settlement);
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
