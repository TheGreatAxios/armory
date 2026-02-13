import type { Context, Next } from "hono";
import type {
  PaymentRequirements,
} from "@armory-sh/base";
import {
  resolveMiddlewareConfig,
  getPrimaryConfig,
  type SimpleMiddlewareConfig,
} from "../src/simple";
import {
  createPaymentRequirements,
  verifyWithFacilitator,
} from "../src/core";
import {
  getHeadersForVersion,
  encodeRequirements,
  decodePayload,
  extractPayerAddress,
} from "../src/payment-utils";

type HttpRequest = {
  headers: Record<string, string | string[] | undefined>;
  method: string;
  url: string;
};

const toHttpRequest = (c: Context): HttpRequest => ({
  headers: Object.fromEntries(c.req.header()),
  method: c.req.method,
  url: c.req.url,
});

/**
 * One-line middleware setup for accepting Armory payments in Hono
 *
 * @example
 * ```ts
 * import { acceptPaymentsViaArmory } from '@armory-sh/middleware/integrations/hono-simple'
 *
 * app.use('/api/*', acceptPaymentsViaArmory({
 *   payTo: '0xMerchantAddress...',
 *   amount: '1.0'
 * }))
 * ```
 */
export const acceptPaymentsViaArmory = (
  config: SimpleMiddlewareConfig & {
    defaultVersion?: 1 | 2;
  }
) => {
  const resolved = resolveMiddlewareConfig(config);

  if ("code" in resolved) {
    throw new Error(`Invalid payment configuration: ${resolved.message}`);
  }

  const primaryConfig = getPrimaryConfig(resolved);
  const defaultVersion = config.defaultVersion ?? 2;
  const requirementsV1 = createPaymentRequirements(primaryConfig, 1);
  const requirementsV2 = createPaymentRequirements(primaryConfig, 2);

  return async (c: Context, next: Next) => {
    const paymentHeader = c.req.header("X-Payment") || c.req.header("x402-payment");

    if (!paymentHeader) {
      const requirements = defaultVersion === 1 ? requirementsV1 : requirementsV2;
      const version = defaultVersion === 1 ? 1 : 2;
      const headers = getHeadersForVersion(version);

      c.status(402);
      c.header(headers.required, encodeRequirements(requirements));
      c.header("Content-Type", "application/json");
      return c.json({ error: "Payment required", requirements });
    }

    try {
      const { payload, version } = decodePayload(paymentHeader);

      if (primaryConfig.facilitator) {
        const verifyResult = await verifyWithFacilitator(toHttpRequest(c), primaryConfig.facilitator);
        if (!verifyResult.success) {
          const requirements = version === 1 ? requirementsV1 : requirementsV2;
          const headers = getHeadersForVersion(version);

          c.status(402);
          c.header(headers.required, encodeRequirements(requirements));
          c.header("Content-Type", "application/json");
          return c.json({ error: `Payment verification failed: ${verifyResult.error}` });
        }
      }

      const payerAddress = extractPayerAddress(payload);
      const headers = getHeadersForVersion(version);

      c.set("payment", { payload, payerAddress, version, verified: true });
      c.header("X-Payment-Verified", "true");
      c.header("X-Payer-Address", payerAddress);
      c.header(headers.response, JSON.stringify({ status: "verified", payerAddress, version }));

      await next();
    } catch (error) {
      c.status(400);
      return c.json({
        error: "Invalid payment payload",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  };
};
