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

// Error types
export { X402ClientError, SigningError, PaymentError } from "./errors";

// Protocol functions for x402 V1 and V2
export {
  detectX402Version,
  parsePaymentRequired,
  createX402Payment,
  createX402V1Payment,
  createX402V2Payment,
  encodeX402Payment,
  getPaymentHeaderName,
  type ParsedPaymentRequirements,
  type X402Wallet as ProtocolWallet,
} from "./protocol";

// Simple one-line API
export {
  armoryPay,
  armoryGet,
  armoryPost,
  getWalletAddress,
  validateNetwork,
  validateToken,
  getNetworks,
  getTokens,
  type SimpleWallet,
} from "./simple";

// Re-export simple types from core
export type {
  NetworkId,
  TokenId,
  ArmoryPaymentResult,
  FacilitatorConfig,
} from "@armory-sh/base";

// Re-export x402 types for convenience
export type {
  X402PaymentPayloadV1,
  X402PaymentRequirementsV1,
  X402PaymentRequiredV1,
  X402SchemePayloadV1,
  X402SettlementResponseV1,
  EIP3009AuthorizationV1,
  PaymentPayloadV2,
  PaymentRequirementsV2,
  PaymentRequiredV2,
  SettlementResponseV2,
  SchemePayloadV2,
  EIP3009Authorization,
  ResourceInfo,
} from "@armory-sh/base";

// Re-export header constants
export { V1_HEADERS, V2_HEADERS } from "@armory-sh/base";
