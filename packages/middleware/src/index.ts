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

// Re-export payment types from base for backward compatibility
export type {
  PaymentRequirementsV1,
  PaymentRequirementsV2,
  SettlementResponseV1,
  SettlementResponseV2,
} from "@armory-sh/base";

// Union type for backward compatibility
export type PaymentRequirements = import("@armory-sh/base").PaymentRequirementsV1 | import("@armory-sh/base").PaymentRequirementsV2;
export type SettlementResponse = import("@armory-sh/base").SettlementResponseV1 | import("@armory-sh/base").SettlementResponseV2;

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

export type {
  PaymentVersion,
  PaymentVerificationResult,
  AnyPaymentPayload,
  LegacyPaymentPayloadV1,
  LegacyPaymentPayloadV2,
} from "./payment-utils.js";

// For backward compatibility, also export as PaymentPayload
export type { AnyPaymentPayload as PaymentPayload } from "./payment-utils.js";

export { createBunMiddleware, acceptPaymentsViaArmory, type BunMiddleware, type BunMiddlewareConfig } from "./bun.js";

// Framework-specific exports are available in the integrations directory
// These require additional dependencies: express, hono, or elysia

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
} from "@armory-sh/base";
