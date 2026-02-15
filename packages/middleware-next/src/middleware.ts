import type { NextRequest, NextResponse } from "next/server";
import type { RoutePaymentConfig } from "./types";
import type { x402ResourceServer } from "./resource-server";
import { paymentProxy } from "./proxy";

export function createMiddleware(
  routes: Record<string, RoutePaymentConfig>,
  resourceServer: x402ResourceServer
): (request: NextRequest) => Promise<NextResponse> {
  const proxy = paymentProxy(routes, resourceServer);

  return async (request: NextRequest): Promise<NextResponse> => {
    const response = await proxy(request);
    return NextResponse.json(await response.json(), { status: response.status });
  };
}
