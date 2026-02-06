// Re-export types from @armory-sh/base
export type {
  PaymentPayloadV1,
  PaymentRequirementsV1,
  SettlementResponseV1,
} from "@armory-sh/base";

export {
  V1_HEADERS,
  encodePaymentPayload,
  decodePaymentPayload,
  encodeSettlementResponse,
  decodeSettlementResponse,
} from "@armory-sh/base";

export type {
  CAIP2ChainId,
  CAIPAssetId,
  Address,
  Signature,
  PayToV2,
  Extensions,
  PaymentPayloadV2,
  PaymentRequirementsV2,
  SettlementResponseV2,
} from "@armory-sh/base";

export {
  V2_HEADERS,
  isCAIP2ChainId,
  isCAIPAssetId,
  isAddress,
} from "@armory-sh/base";

export type {
  PaymentPayload,
  PaymentRequirements,
  SettlementResponse,
} from "@armory-sh/base";

export {
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
} from "@armory-sh/base";

export type { NetworkConfig } from "@armory-sh/base";

export {
  NETWORKS,
  getNetworkConfig,
  getNetworkByChainId,
  getMainnets,
  getTestnets,
} from "@armory-sh/base";

export type {
  TransferWithAuthorizationParams,
  BalanceOfParams,
} from "@armory-sh/base";

export { ERC20_ABI } from "@armory-sh/base";

export {
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
  decodeSettlement,
  isPaymentV1,
  isPaymentV2,
  isSettlementV1,
  isSettlementV2,
} from "@armory-sh/base";

export {
  EIP712_TYPES,
  createEIP712Domain,
  createTransferWithAuthorization,
  validateTransferWithAuthorization,
} from "@armory-sh/base";

// Ethers-specific exports
export {
  createPaymentPayloadV1,
  createPaymentPayloadV2,
  createPaymentPayload,
  parsePaymentRequirements,
  detectProtocolVersion,
} from "./protocol";

export type { Signer } from "./types";
export type { X402ClientConfig, ClientConfig } from "./types";
export { createX402Transport } from "./transport";
