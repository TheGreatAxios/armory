import type {
  X402PaymentPayload,
  X402PaymentRequirements,
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

export type { PaymentConfig, ResolvedRequirementsConfig } from "./payment";
export {
  createPaymentRequirements,
  paymentMiddleware,
  resolveFacilitatorUrlFromRequirement,
} from "./payment";
export {
  type PaymentMiddlewareConfigEntry,
  type RouteAwarePaymentInfo,
  type RouteAwarePaymentMiddlewareConfig,
  routeAwarePaymentMiddleware,
} from "./routes";
