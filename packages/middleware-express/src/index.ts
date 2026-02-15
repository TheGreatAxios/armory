import type { Request, Response, NextFunction } from "express";
import type {
  PaymentPayloadV2,
  PaymentRequirements,
} from "@armory-sh/base";
import {
  decodePaymentV2,
  createPaymentRequiredHeaders,
  createSettlementHeaders,
  PAYMENT_SIGNATURE_HEADER,
} from "@armory-sh/base";

export interface PaymentMiddlewareConfig {
  requirements: PaymentRequirements;
  facilitatorUrl?: string;
  skipVerification?: boolean;
  network?: string;
}

export interface AugmentedRequest extends Request {
  payment?: {
    payload: PaymentPayloadV2;
    payerAddress: string;
    verified: boolean;
  };
}

export const paymentMiddleware = (config: PaymentMiddlewareConfig) => {
  const { requirements, facilitatorUrl, skipVerification = false, network = "base" } = config;

  return async (req: AugmentedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const paymentHeader = req.headers[PAYMENT_SIGNATURE_HEADER.toLowerCase()] as string | undefined;

      if (!paymentHeader) {
        const requiredHeaders = createPaymentRequiredHeaders(requirements);
        res.statusCode = 402;
        for (const [key, value] of Object.entries(requiredHeaders)) {
          res.setHeader(key, value);
        }
        res.json({
          error: "Payment required",
          accepts: [requirements],
        });
        return;
      }

      let paymentPayload: PaymentPayloadV2;
      try {
        paymentPayload = decodePaymentV2(paymentHeader);
      } catch (error) {
        res.statusCode = 400;
        res.json({
          error: "Invalid payment payload",
          message: error instanceof Error ? error.message : "Unknown error",
        });
        return;
      }

      const payerAddress = paymentPayload.payload.authorization.from;

      // TODO: Add verification with facilitator if not skipVerification
      // if (!skipVerification && facilitatorUrl) {
      //   const result = await verifyWithFacilitator(...);
      //   if (!result.success) { ... }
      // }

      const settlement = {
        success: true,
        transaction: "",
        network,
      };

      const settlementHeaders = createSettlementHeaders(settlement);
      for (const [key, value] of Object.entries(settlementHeaders)) {
        res.setHeader(key, value);
      }

      req.payment = { payload: paymentPayload, payerAddress, verified: !skipVerification };
      next();
    } catch (error) {
      res.statusCode = 500;
      res.json({
        error: "Payment middleware error",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  };
};
