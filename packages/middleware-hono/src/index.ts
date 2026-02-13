import type { Context, Next } from "hono";
import type {
  PaymentRequirements,
  X402PaymentRequirementsV1,
  PaymentRequirementsV2,
} from "@armory-sh/base";
import {
  V1_HEADERS,
  V2_HEADERS,
} from "@armory-sh/base";
import {
  resolveMiddlewareConfig,
  getPrimaryConfig,
  type SimpleMiddlewareConfig,
} from "./simple";
import {
  createPaymentRequirements,
  verifyWithFacilitator,
  createX402V1PaymentRequiredHeaders,
  createX402V2PaymentRequiredHeaders,
  createSettlementHeaders,
} from "./core";
import {
  getHeadersForVersion,
  decodePayload,
  extractPayerAddress,
} from "./payment-utils";

type HttpRequest = {
  headers: Record<string, string | string[] | undefined>;
  method: string;
  url: string;
};

const toHttpRequest = (c: Context): HttpRequest => ({
  headers: Object.fromEntries(Object.entries(c.req.header()).map(([k, v]) => [k, v ?? ""])),
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

  // Lazy creation to avoid crypto.randomUUID() at global scope in Cloudflare Workers
  const createRequirementsForVersion = (version: 1 | 2, resourceUrl: string) =>
    createPaymentRequirements(primaryConfig, version, resourceUrl);

  /**
   * Create x402-compliant payment required headers
   */
  const createPaymentRequiredResponse = (
    version: 1 | 2,
    requirements: PaymentRequirements,
    resourceUrl: string,
    errorMessage?: string
  ): Record<string, string> => {
    if (version === 1) {
      return createX402V1PaymentRequiredHeaders(
        requirements as X402PaymentRequirementsV1,
        errorMessage ?? "X-PAYMENT header is required"
      );
    }
    return createX402V2PaymentRequiredHeaders(
      requirements as PaymentRequirementsV2,
      resourceUrl,
      { errorMessage }
    );
  };

  return async (c: Context, next: Next) => {
    // Check for payment header (supports both x402 V1 and V2)
    const paymentHeader =
      c.req.header(V1_HEADERS.PAYMENT) ||
      c.req.header(V2_HEADERS.PAYMENT_SIGNATURE) ||
      c.req.header("X-PAYMENT"); // Fallback for case variations

    const resourceUrl = c.req.url;

    if (!paymentHeader) {
      const version = defaultVersion === 1 ? 1 : 2;
      const requirements = createRequirementsForVersion(version, resourceUrl);
      const headers = createPaymentRequiredResponse(version, requirements, resourceUrl);

      c.status(402);
      // Set all headers from the response
      for (const [key, value] of Object.entries(headers)) {
        c.header(key, value);
      }
      return c.json({
        error: "Payment required",
        x402Version: version,
        accepts: [requirements]
      });
    }

    try {
      const { payload, version } = decodePayload(paymentHeader);

      if (primaryConfig.facilitator) {
        const verifyResult = await verifyWithFacilitator(toHttpRequest(c), primaryConfig.facilitator);
        if (!verifyResult.success) {
          const requirements = createRequirementsForVersion(version, resourceUrl);
          const headers = createPaymentRequiredResponse(
            version,
            requirements,
            resourceUrl,
            `Payment verification failed: ${verifyResult.error}`
          );

          c.status(402);
          for (const [key, value] of Object.entries(headers)) {
            c.header(key, value);
          }
          return c.json({
            error: `Payment verification failed: ${verifyResult.error}`,
            x402Version: version
          });
        }
      }

      const payerAddress = extractPayerAddress(payload);
      const responseHeaders = getHeadersForVersion(version);

      c.set("payment", { payload, payerAddress, version, verified: true });
      c.header("X-Payment-Verified", "true");
      c.header("X-Payer-Address", payerAddress);

      // Create proper x402 settlement response
      const settlementResponse = {
        success: true,
        transaction: "",
        network: version === 1 ? "base-sepolia" : "eip155:84532",
        payer: payerAddress as `0x${string}`,
      };
      const settlementHeaders = createSettlementHeaders(settlementResponse, version, undefined, payerAddress);
      for (const [key, value] of Object.entries(settlementHeaders)) {
        c.header(key, value);
      }

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
