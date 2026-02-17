import type { PaymentRequiredV2, ResourceInfo } from "@armory-sh/base";
import {
  findMatchingRoute,
  safeBase64Encode,
  V2_HEADERS,
} from "@armory-sh/base";
import type { NextRequest } from "next/server";
import type { x402ResourceServer } from "./resource-server";
import type { RoutePaymentConfig } from "./types";

interface RouteConfig {
  pattern: string;
  config: RoutePaymentConfig;
}

type UpstreamHandler = (
  request: NextRequest,
  route: RouteConfig,
  verify: { success: boolean; payerAddress?: string; error?: string },
) => Promise<Response>;

export function paymentProxy(
  routes: Record<string, RoutePaymentConfig>,
  resourceServer: x402ResourceServer,
  upstream?: UpstreamHandler,
): (request: NextRequest) => Promise<Response> {
  const routeConfigs: RouteConfig[] = Object.entries(routes).map(
    ([pattern, config]) => ({ pattern, config }),
  );

  return async (request: NextRequest): Promise<Response> => {
    const path = new URL(request.url).pathname;
    const matchedRoute = findMatchingRoute(routeConfigs, path);

    if (!matchedRoute) {
      return new Response(JSON.stringify({ error: "Route not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    const paymentHeader = request.headers.get(V2_HEADERS.PAYMENT_SIGNATURE);

    if (!paymentHeader) {
      const config = matchedRoute.config;
      const resource: ResourceInfo = {
        url: request.url,
        description: config.description || "API Access",
        mimeType: "application/json",
      };

      const paymentRequired: PaymentRequiredV2 = {
        x402Version: 2,
        error: "Payment required",
        resource,
        accepts: [
          {
            scheme: config.accepts.scheme,
            network: config.accepts.network,
            amount: config.accepts.price,
            asset: config.accepts.payTo as `0x${string}`,
            payTo: config.accepts.payTo as `0x${string}`,
            maxTimeoutSeconds: 300,
            extra: {},
          },
        ],
      };

      return new Response(
        JSON.stringify({
          error: "Payment required",
          accepts: paymentRequired.accepts,
        }),
        {
          status: 402,
          headers: {
            "Content-Type": "application/json",
            [V2_HEADERS.PAYMENT_REQUIRED]: safeBase64Encode(
              JSON.stringify(paymentRequired),
            ),
          },
        },
      );
    }

    const facilitator = resourceServer.getFacilitator();
    const verifyResult = await facilitator.verify(request.headers);

    if (!verifyResult.success) {
      return new Response(
        JSON.stringify({
          error: "Payment verification failed",
          details: verifyResult.error,
        }),
        { status: 402, headers: { "Content-Type": "application/json" } },
      );
    }

    const handler =
      upstream ??
      (async () =>
        new Response(
          JSON.stringify({
            verified: true,
            payerAddress: verifyResult.payerAddress,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ));
    const upstreamResponse = await handler(request, matchedRoute, verifyResult);

    if (upstreamResponse.status >= 400) {
      return upstreamResponse;
    }

    if (!facilitator.settle) {
      return upstreamResponse;
    }

    const settleResult = await facilitator.settle(request.headers);
    if (!settleResult.success) {
      return new Response(
        JSON.stringify({
          error: "Settlement failed",
          details: settleResult.error,
        }),
        { status: 502, headers: { "Content-Type": "application/json" } },
      );
    }

    const responseHeaders = new Headers(upstreamResponse.headers);
    responseHeaders.set(
      V2_HEADERS.PAYMENT_RESPONSE,
      safeBase64Encode(
        JSON.stringify({
          success: true,
          transaction: settleResult.txHash || "",
        }),
      ),
    );

    return new Response(upstreamResponse.body, {
      status: upstreamResponse.status,
      headers: responseHeaders,
    });
  };
}
