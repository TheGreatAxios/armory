// Main client exports

// Armory API
export {
  type ArmoryConfig,
  type ArmoryInstance,
  createArmory,
  type HttpMethod,
  type PaymentOptions,
} from "./armory-api";
export { createX402Client } from "./client";

// EIP-3009 exports
export {
  adjustVForChainId,
  concatenateSignature,
  createEIP712Domain,
  createTransferWithAuthorization,
  parseSignature,
  signTypedData,
  signWithPrivateKey,
  validateTransferWithAuthorization,
} from "./eip3009";

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
// Transport exports
export { createX402Transport } from "./transport";
