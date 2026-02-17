// Main client exports
export { createX402Client, createX402Transport } from "./client";
export {
  type X402Client,
  type X402ClientConfig,
  type X402Wallet,
  type X402ProtocolVersion,
  type Token,
  type PaymentResult,
  type X402TransportConfig,
} from "./types";

// Hook system
export {
  type ViemPaymentPayloadContext,
  type ViemHookConfig,
  type ViemHookRegistry,
} from "./hooks";
export { executeHooks, mergeExtensions } from "./hooks-engine";

// Protocol functions
export {
  detectX402Version,
  parsePaymentRequired,
  type ParsedPaymentRequirements,
} from "./protocol";

// Simple one-line API
export {
  armoryPay,
  armoryGet,
  armoryPost,
  armoryPut,
  armoryDelete,
  armoryPatch,
  getWalletAddress,
  validateNetwork,
  validateToken,
  getNetworks,
  getTokens,
  normalizeWallet,
  type SimpleWalletInput,
  type NormalizedWallet,
} from "./payment-api";

// Armory API
export {
  createArmory,
  type ArmoryConfig,
  type ArmoryInstance,
  type PaymentOptions,
  type HttpMethod,
} from "./armory-api";

// Extension support
export {
  parseExtensions,
  extractExtension,
  createSIWxProof,
  addExtensionsToPayload,
  type ClientExtensionContext,
} from "./extensions";
