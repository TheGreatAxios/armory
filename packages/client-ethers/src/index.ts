// Re-export types from @armory/core
export type {
  PaymentPayloadV1,
  PaymentRequirementsV1,
  SettlementResponseV1,
} from "@armory/core";

export {
  V1_HEADERS,
  encodePaymentPayload,
  decodePaymentPayload,
  encodeSettlementResponse,
  decodeSettlementResponse,
} from "@armory/core";

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
} from "@armory/core";

export {
  V2_HEADERS,
  isCAIP2ChainId,
  isCAIPAssetId,
  isAddress,
} from "@armory/core";

export type {
  PaymentPayload,
  PaymentRequirements,
  SettlementResponse,
} from "@armory/core";

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
} from "@armory/core";

export type { NetworkConfig } from "@armory/core";

export {
  NETWORKS,
  getNetworkConfig,
  getNetworkByChainId,
  getMainnets,
  getTestnets,
} from "@armory/core";

export type {
  TransferWithAuthorizationParams,
  BalanceOfParams,
} from "@armory/core";

export { ERC20_ABI } from "@armory/core";

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
} from "@armory/core";

export {
  EIP712_TYPES,
  createEIP712Domain,
  createTransferWithAuthorization,
  validateTransferWithAuthorization,
} from "@armory/core";

// Ethers-specific exports
export {
  createPaymentPayloadV1,
  createPaymentPayloadV2,
  createPaymentPayload,
  parsePaymentRequirements,
  detectProtocolVersion,
} from "./protocol";

export type { Signer, EthersSignerOptions } from "./types";
export { createX402Transport } from "./transport";
