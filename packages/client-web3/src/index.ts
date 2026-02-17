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
