// Main client exports
export { createX402Client } from "./client";

// Transport exports
export { createX402Transport } from "./transport";

// EIP-3009 exports
export {
  createEIP712Domain,
  createTransferWithAuthorization,
  parseSignature,
  concatenateSignature,
  validateTransferWithAuthorization,
  adjustVForChainId,
  signTypedData,
  signWithPrivateKey,
} from "./eip3009";

// Re-export base types for convenience
export type {
  PaymentPayloadV2,
  PaymentRequirementsV2,
  EIP3009Authorization,
  SchemePayloadV2,
  SettlementResponseV2,
} from "@armory-sh/base";
