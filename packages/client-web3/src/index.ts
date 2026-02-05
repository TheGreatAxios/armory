export { createX402Client } from "./client";

export type {
  Web3X402Client,
  Web3ClientConfig,
  Token,
  PaymentSignOptions,
  PaymentSignatureResult,
} from "./types";

export { createX402Transport, createFetchWithX402 } from "./transport";

export type {
  X402Transport,
  X402TransportOptions,
  X402RequestContext,
} from "./types";

export {
  createEIP712Domain,
  createTransferWithAuthorization,
  validateTransferWithAuthorization,
  parseSignature,
  concatenateSignature,
  adjustVForChainId,
  signTypedData,
  signWithPrivateKey,
  EIP712_TYPES,
  USDC_DOMAIN,
} from "./eip3009";

export type {
  Web3Account,
  Web3TransferWithAuthorization,
  Web3EIP712Domain,
} from "./types";

export {
  isV1Requirements,
  isV2Requirements,
  isV1Settlement,
  isV2Settlement,
} from "./types";

export type {
  PaymentPayloadV1,
  PaymentPayloadV2,
  PaymentPayload,
  PaymentRequirementsV1,
  PaymentRequirementsV2,
  PaymentRequirements,
  SettlementResponseV1,
  SettlementResponseV2,
  SettlementResponse,
  NetworkConfig,
} from "@armory/core";

export {
  V1_HEADERS,
  encodePaymentV1,
  decodePaymentV1,
  encodeSettlementV1,
  decodeSettlementV1,
  V2_HEADERS,
  isCAIP2ChainId,
  isCAIPAssetId,
  isAddress,
  encodePaymentV2,
  decodePaymentV2,
  encodeSettlementV2,
  decodeSettlementV2,
  isV1,
  isV2,
  getPaymentVersionFromPayload,
  getRequirementsVersion,
  getSettlementVersion,
  getPaymentHeaderName,
  getPaymentResponseHeaderName,
  getPaymentRequiredHeaderName,
  isSettlementSuccessful,
  getTxHash,
  NETWORKS,
  getNetworkConfig,
  getNetworkByChainId,
  getMainnets,
  getTestnets,
  EIP712_TYPES as CORE_EIP712_TYPES,
  USDC_DOMAIN as CORE_USDC_DOMAIN,
  createEIP712Domain as createCoreEIP712Domain,
  createTransferWithAuthorization as createCoreTransferWithAuthorization,
  validateTransferWithAuthorization as validateCoreTransferWithAuthorization,
} from "@armory/core";
