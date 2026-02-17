import { Elysia } from "elysia";
import type {
  X402PaymentPayload,
  X402PaymentRequirements,
  VerifyResponse,
  X402SettlementResponse,
} from "@armory-sh/base";
import {
  createPaymentRequiredHeaders,
  createSettlementHeaders,
  PAYMENT_SIGNATURE_HEADER,
  decodePayloadHeader,
  verifyPayment,
  settlePayment,
} from "@armory-sh/base";

export interface PaymentMiddlewareConfig {
  requirements: X402PaymentRequirements;
  facilitatorUrl: string;
}

export interface PaymentInfo {
  payload: X402PaymentPayload;
  payerAddress: string;
  verified: boolean;
}

export interface PaymentContext {
  payment: PaymentInfo;
}

export { routeAwarePaymentMiddleware, type RouteAwarePaymentMiddlewareConfig, type PaymentMiddlewareConfigEntry, type RouteAwarePaymentInfo } from "./routes";
export { paymentMiddleware, createPaymentRequirements, resolveFacilitatorUrlFromRequirement } from "./payment";
export type { PaymentConfig, ResolvedRequirementsConfig } from "./payment";
