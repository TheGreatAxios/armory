/**
 * @armory-sh/extensions
 *
 * x402 protocol extensions for Armory
 * Provides Bazaar Discovery and Sign-In-With-X extensions
 */

export type {
  Extension,
  JSONSchema,
  BazaarExtensionInfo,
  SIWxExtensionInfo,
  SIWxPayload,
  DiscoveredResource,
  BazaarDiscoveryConfig,
  SIWxExtensionConfig,
  PaymentIdentifierExtensionInfo,
  PaymentIdentifierConfig,
} from "./types.js";

export {
  BAZAAR,
  SIGN_IN_WITH_X,
  PAYMENT_IDENTIFIER,
} from "./types.js";

export {
  declareDiscoveryExtension,
  extractDiscoveryInfo,
  validateDiscoveryExtension,
  createDiscoveryConfig,
  isDiscoveryExtension,
} from "./bazaar.js";

export {
  declareSIWxExtension,
  parseSIWxHeader,
  validateSIWxMessage,
  verifySIWxSignature,
  createSIWxMessage,
  encodeSIWxHeader,
  createSIWxPayload,
  isSIWxExtension,
} from "./sign-in-with-x.js";

export {
  validateExtension,
  extractExtension,
  createExtension,
  validateWithSchema,
} from "./validators.js";

export {
  declarePaymentIdentifierExtension,
  extractPaymentIdentifierInfo,
  validatePaymentIdentifierExtension,
  isPaymentIdentifierExtension,
} from "./payment-identifier.js";

export {
  createSIWxHook,
  createPaymentIdHook,
  createCustomHook,
  type SIWxHookConfig,
  type PaymentIdHookConfig,
} from "./hooks.js";

export type { ValidationError, ValidationResult } from "./validators.js";
