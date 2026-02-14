import type { Request, Response, NextFunction } from "express";
import type {
  PaymentPayload,
  PaymentRequirements,
} from "./payment-utils";
import {
  getRequirementsVersion,
  getHeadersForVersion,
  encodeRequirements,
  decodePayload,
  verifyWithFacilitator,
  extractPayerAddress,
} from "./payment-utils";

export interface PaymentMiddlewareConfig {
  requirements: PaymentRequirements;
  facilitatorUrl?: string;
  skipVerification?: boolean;
}

export interface AugmentedRequest extends Request {
  payment?: {
    payload: PaymentPayload;
    payerAddress: string;
    version: 1 | 2;
    verified: boolean;
  };
}

const sendError = (
  res: Response,
  status: number,
  headers: Record<string, string>,
  body: unknown
): void => {
  res.status(status);
  Object.entries(headers).forEach(([k, v]) => res.setHeader(k, v));
  res.json(body);
};

export const paymentMiddleware = (config: PaymentMiddlewareConfig) => {
  const { requirements, facilitatorUrl, skipVerification = false } = config;
  const version = getRequirementsVersion(requirements);
  const headers = getHeadersForVersion(version);

  return async (req: AugmentedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const paymentHeader = req.headers[headers.payment.toLowerCase()] as string | undefined;

      if (!paymentHeader) {
        sendError(res, 402, { [headers.required]: encodeRequirements(requirements), "Content-Type": "application/json" }, { error: "Payment required", accepts: [requirements] });
        return;
      }

      let payload: PaymentPayload;
      let payloadVersion: 1 | 2;
      try {
        ({ payload, version: payloadVersion } = decodePayload(paymentHeader));
      } catch (error) {
        sendError(res, 400, {}, { error: "Invalid payment payload", message: error instanceof Error ? error.message : "Unknown error" });
        return;
      }

      if (payloadVersion !== version) {
        sendError(res, 400, {}, { error: "Payment version mismatch", expected: version, received: payloadVersion });
        return;
      }

      const payerAddress = skipVerification
        ? extractPayerAddress(payload)
        : await (async () => {
            const result = await verifyWithFacilitator(facilitatorUrl!, payload, requirements);
            if (!result.success) {
              sendError(res, 402, { [headers.required]: encodeRequirements(requirements) }, { error: result.error });
              throw new Error("Verification failed");
            }
            return result.payerAddress!;
          })();

      req.payment = { payload, payerAddress, version, verified: !skipVerification };
      res.setHeader(headers.response, JSON.stringify({ status: "verified", payerAddress, version }));
      next();
    } catch (error) {
      sendError(res, 500, {}, { error: "Payment middleware error", message: error instanceof Error ? error.message : "Unknown error" });
    }
  };
};
