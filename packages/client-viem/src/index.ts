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
export { X402ClientError, SigningError, PaymentError } from "./errors";

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
