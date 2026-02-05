export type {
  FacilitatorConfig,
  MiddlewareConfig,
  SettlementMode,
  PayToAddress,
  HttpRequest,
  HttpResponse,
  FacilitatorVerifyResult,
  FacilitatorSettleResult,
} from "./types.js";

export {
  createPaymentRequirements,
  verifyWithFacilitator,
  settleWithFacilitator,
  createPaymentRequiredHeaders,
  createSettlementHeaders,
} from "./core.js";

export {
  getHeadersForVersion,
  getRequirementsVersion,
  encodeRequirements,
  decodePayload,
  verifyPaymentWithRetry,
  extractPayerAddress,
  createResponseHeaders,
} from "./payment-utils.js";

export type { PaymentVersion, PaymentVerificationResult } from "./payment-utils.js";

export { createBunMiddleware, acceptPaymentsViaArmory, type BunMiddleware, type BunMiddlewareConfig } from "./bun.js";

// Framework-specific exports (optional - requires framework dependencies)
export { paymentMiddleware, type AugmentedRequest, type PaymentMiddlewareConfig } from "./express.js";
export {
  paymentMiddleware as honoPaymentMiddleware,
  type PaymentMiddlewareConfig as HonoPaymentMiddlewareConfig,
  type PaymentInfo,
  type PaymentVariables,
} from "./hono.js";
export {
  paymentMiddleware as elysiaPaymentMiddleware,
  type PaymentMiddlewareConfig as ElysiaPaymentMiddlewareConfig,
  type PaymentInfo as ElysiaPaymentInfo,
  type PaymentContext,
} from "./elysia.js";

// Simple one-line API for merchants
export {
  resolveMiddlewareConfig,
  getRequirements,
  getPrimaryConfig,
  getSupportedNetworks,
  getSupportedTokens,
  isSupported,
  type SimpleMiddlewareConfig,
  type ResolvedMiddlewareConfig,
} from "./simple.js";

// Re-export simple types from core
export type {
  NetworkId,
  TokenId,
  FacilitatorConfig as SimpleFacilitatorConfig,
  AcceptPaymentOptions,
} from "@armory/base";
