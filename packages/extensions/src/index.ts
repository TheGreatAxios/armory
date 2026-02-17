/**
 * @armory-sh/extensions
 *
 * x402 protocol extensions for Armory
 * Provides Bazaar Discovery and Sign-In-With-X extensions
 */

export {
  createDiscoveryConfig,
  declareDiscoveryExtension,
  extractDiscoveryInfo,
  isDiscoveryExtension,
  validateDiscoveryExtension,
} from "./bazaar.js";
export {
  createCustomHook,
  createPaymentIdHook,
  createSIWxHook,
  type PaymentIdHookConfig,
  type SIWxHookConfig,
} from "./hooks.js";
export {
  declarePaymentIdentifierExtension,
  extractPaymentIdentifierInfo,
  isPaymentIdentifierExtension,
  validatePaymentIdentifierExtension,
} from "./payment-identifier.js";

export {
  createSIWxMessage,
  createSIWxPayload,
  declareSIWxExtension,
  encodeSIWxHeader,
  isSIWxExtension,
  parseSIWxHeader,
  validateSIWxMessage,
  verifySIWxSignature,
} from "./sign-in-with-x.js";
export type {
  BazaarDiscoveryConfig,
  BazaarExtensionInfo,
  DiscoveredResource,
  Extension,
  PaymentIdentifierConfig,
  PaymentIdentifierExtensionInfo,
  SIWxExtensionConfig,
  SIWxExtensionInfo,
  SIWxPayload,
} from "./types.js";
export {
  BAZAAR,
  PAYMENT_IDENTIFIER,
  SIGN_IN_WITH_X,
} from "./types.js";
export {
  createExtension,
  extractExtension,
  validateExtension,
} from "./validators.js";
