// Re-export types from @armory-sh/base
export type {
  PaymentPayloadV1,
  PaymentRequirementsV1,
  SettlementResponseV1,
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
  V1_HEADERS,
  V2_HEADERS,
  isV1,
  isV2,
  getPaymentVersion,
  getRequirementsVersion,
  getSettlementVersion,
  getPaymentHeaderName as getPaymentHeaderNameBase,
  getPaymentResponseHeaderName,
  getPaymentRequiredHeaderName,
  isSettlementSuccessful,
  getTxHash,
  NETWORKS,
  getNetworkConfig,
  getNetworkByChainId,
  getMainnets,
  getTestnets,
  ERC20_ABI,
  encodePaymentV1,
  decodePaymentV1,
  encodeSettlementV1,
  decodeSettlementV1,
  encodePaymentV2,
  decodePaymentV2,
  encodeSettlementV2,
  decodeSettlementV2,
  detectPaymentVersion,
  decodePayment,
  decodeSettlementLegacy,
  isPaymentV1,
  isPaymentV2,
  isSettlementV1,
  isSettlementV2,
  isX402V1PaymentRequired,
  isX402V2PaymentRequired,
  isX402V1Requirements,
  EIP712_TYPES,
  createEIP712Domain,
  createTransferWithAuthorization,
  validateTransferWithAuthorization,
  isCAIP2ChainId,
  isCAIPAssetId,
  safeBase64Decode,
} from "@armory-sh/base";

// Ethers-specific exports - x402 protocol functions
export {
  detectX402Version,
  parsePaymentRequired,
  createX402V1Payment,
  createX402V2Payment,
  createX402Payment,
  encodeX402Payment,
  getPaymentHeaderName,
  // Legacy compatibility (deprecated)
  createPaymentPayload,
  parsePaymentRequirements,
  detectProtocolVersion,
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
