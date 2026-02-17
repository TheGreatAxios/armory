// Ethers-specific exports - x402 protocol functions (V2 only)

// Armory API
export {
  type ArmoryConfig,
  type ArmoryInstance,
  createArmory,
  type HttpMethod,
  type PaymentOptions,
} from "./armory-api";
// X402 Client factory
export { createX402Client, type X402Client } from "./client";
// EIP-3009 signing utilities
export {
  recoverEIP3009Signer,
  signEIP3009,
  signEIP3009WithDomain,
  signPayment,
} from "./eip3009";
// Errors (ethers-specific + re-exported shared)
export {
  AuthorizationError,
  PaymentError,
  ProviderRequiredError,
  SignerRequiredError,
  SigningError,
  X402ClientError,
} from "./errors";
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
export {
  createX402Payment,
  detectX402Version,
  getPaymentHeaderName,
  type ParsedPaymentRequirements,
  parsePaymentRequired,
} from "./protocol";
export type { X402Transport } from "./transport";
// Transport
export { createX402Transport } from "./transport";
// Types
export type {
  ClientConfig,
  Provider,
  Signer,
  X402ClientConfig,
  X402RequestInit,
  X402TransportConfig,
} from "./types";
