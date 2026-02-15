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
  getWalletAddress,
  validateNetwork,
  validateToken,
  getNetworks,
  getTokens,
  type SimpleWallet,
} from "./payment-api";

// Re-export simple types from core
export type {
  NetworkId,
  TokenId,
  ArmoryPaymentResult,
  FacilitatorConfig,
} from "@armory-sh/base";

// Re-export x402 V2 types for convenience
export type {
  PaymentPayloadV2,
  PaymentRequirementsV2,
  PaymentRequiredV2,
  SettlementResponseV2,
  SchemePayloadV2,
  EIP3009Authorization,
  ResourceInfo,
} from "@armory-sh/base";

// Re-export header constants
export { V2_HEADERS } from "@armory-sh/base";
