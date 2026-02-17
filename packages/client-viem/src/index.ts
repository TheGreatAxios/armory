// Main client exports

// Armory API
export {
  type ArmoryConfig,
  type ArmoryInstance,
  createArmory,
  type HttpMethod,
  type PaymentOptions,
} from "./armory-api";
export { createX402Client, createX402Transport } from "./client";
// Extension support
export {
  addExtensionsToPayload,
  type ClientExtensionContext,
  createSIWxProof,
  extractExtension,
  parseExtensions,
} from "./extensions";
// Hook system
export type {
  ViemHookConfig,
  ViemHookRegistry,
  ViemPaymentPayloadContext,
} from "./hooks";
export { executeHooks, mergeExtensions } from "./hooks-engine";

// Simple one-line API
export {
  armoryDelete,
  armoryGet,
  armoryPatch,
  armoryPay,
  armoryPost,
  armoryPut,
  getNetworks,
  getTokens,
  getWalletAddress,
  type NormalizedWallet,
  normalizeWallet,
  type SimpleWalletInput,
  validateNetwork,
  validateToken,
} from "./payment-api";
// Protocol functions
export {
  detectX402Version,
  type ParsedPaymentRequired,
  parsePaymentRequired,
} from "./protocol";
export type {
  PaymentResult,
  Token,
  X402Client,
  X402ClientConfig,
  X402ProtocolVersion,
  X402TransportConfig,
  X402Wallet,
} from "./types";
