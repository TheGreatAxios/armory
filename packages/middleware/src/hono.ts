import type { Context, Next } from "hono";
import type {
  PaymentPayload,
  PaymentRequirements,
} from "@armory/core";
import type { VerifyPaymentOptions } from "@armory/facilitator";
import {
  getRequirementsVersion,
  getHeadersForVersion,
  encodeRequirements,
  decodePayload,
  verifyPaymentWithRetry,
  extractPayerAddress,
} from "./payment-utils";

export interface PaymentMiddlewareConfig {
  requirements: PaymentRequirements;
  facilitatorUrl?: string;
  verifyOptions?: VerifyPaymentOptions;
  skipVerification?: boolean;
}

export interface PaymentInfo {
  payload: PaymentPayload;
  payerAddress: string;
  version: 1 | 2;
  verified: boolean;
}

export type PaymentVariables = { payment: PaymentInfo };

const sendError = (
  c: Context,
  status: number,
  headers: Record<string, string>,
  body: unknown
): void => {
  c.status(status);
  Object.entries(headers).forEach(([k, v]) => c.header(k, v));
  c.json(body);
};

export const paymentMiddleware = (config: PaymentMiddlewareConfig) => {
  const { requirements, facilitatorUrl, verifyOptions, skipVerification = false } = config;
  const version = getRequirementsVersion(requirements);
  const headers = getHeadersForVersion(version);

  return async (c: Context, next: Next): Promise<void> => {
    try {
      const paymentHeader = c.req.header(headers.payment);

      if (!paymentHeader) {
        sendError(c, 402, { [headers.required]: encodeRequirements(requirements), "Content-Type": "application/json" }, { error: "Payment required", requirements });
        return;
      }

      let payload: PaymentPayload;
      let payloadVersion: 1 | 2;
      try {
        ({ payload, version: payloadVersion } = decodePayload(paymentHeader));
      } catch (error) {
        sendError(c, 400, {}, { error: "Invalid payment payload", message: error instanceof Error ? error.message : "Unknown error" });
        return;
      }

      if (payloadVersion !== version) {
        sendError(c, 400, {}, { error: "Payment version mismatch", expected: version, received: payloadVersion });
        return;
      }

      const payerAddress = skipVerification
        ? extractPayerAddress(payload)
        : await (async () => {
            const result = await verifyPaymentWithRetry(payload, requirements, facilitatorUrl, verifyOptions);
            if (!result.success) {
              sendError(c, 402, { [headers.required]: encodeRequirements(requirements) }, { error: result.error });
              throw new Error("Verification failed");
            }
            return result.payerAddress!;
          })();

      c.set("payment", { payload, payerAddress, version, verified: !skipVerification });
      c.header(headers.response, JSON.stringify({ status: "verified", payerAddress, version }));
      await next();
    } catch (error) {
      sendError(c, 500, {}, { error: "Payment middleware error", message: error instanceof Error ? error.message : "Unknown error" });
    }
  };
};
