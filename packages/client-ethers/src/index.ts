// Re-export types from @armory-sh/base
export type {
  PaymentPayloadV2,
  PaymentRequirementsV2,
  SettlementResponseV2,
  PaymentPayload,
  PaymentRequirements,
  SettlementResponse,
  CAIP2ChainId,
  CAIPAssetId,
  Address,
  Signature,
  PayToV2,
  Extensions,
  NetworkConfig,
  TransferWithAuthorizationParams,
  BalanceOfParams,
} from "@armory-sh/base";

export {
  V2_HEADERS,
  isSettlementSuccessful,
  getTxHash,
  NETWORKS,
  getNetworkConfig,
  getNetworkByChainId,
  getMainnets,
  getTestnets,
  ERC20_ABI,
  encodePaymentV2,
  decodePaymentV2,
  encodeSettlementV2,
  decodeSettlementV2,
  detectPaymentVersion,
  decodePayment,
  isPaymentV2,
  isSettlementV2,
  isX402V2PaymentRequired,
  EIP712_TYPES,
  createEIP712Domain,
  createTransferWithAuthorization,
  validateTransferWithAuthorization,
  isCAIP2ChainId,
  isCAIPAssetId,
  safeBase64Decode,
} from "@armory-sh/base";

// Ethers-specific exports - x402 protocol functions (V2 only)
export {
  detectX402Version,
  parsePaymentRequired,
  createX402Payment,
  encodeX402Payment,
  getPaymentHeaderName,
  type ParsedPaymentRequirements,
} from "./protocol";

// Errors
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
