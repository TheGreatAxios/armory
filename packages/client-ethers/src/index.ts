// Ethers-specific exports - x402 protocol functions (V2 only)
export {
  detectX402Version,
  parsePaymentRequired,
  createX402Payment,
  getPaymentHeaderName,
  type ParsedPaymentRequirements,
} from "./protocol";

// Errors (ethers-specific + re-exported shared)
export {
  X402ClientError,
  SigningError,
  PaymentError,
  SignerRequiredError,
  AuthorizationError,
  ProviderRequiredError,
} from "./errors";

// Types
export type { Signer, Provider } from "./types";
export type { X402ClientConfig, ClientConfig, X402TransportConfig, X402RequestInit } from "./types";

// Transport
export { createX402Transport } from "./transport";
export type { X402Transport } from "./transport";

// EIP-3009 signing utilities
export { signEIP3009, signEIP3009WithDomain, signPayment, recoverEIP3009Signer } from "./eip3009";

// X402 Client factory
export { createX402Client, type X402Client } from "./client";

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
