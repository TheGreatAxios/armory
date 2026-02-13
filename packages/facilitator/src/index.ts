// Legacy payment verification (original Armory format)
export { verifyPayment } from "./verify";

export type { VerificationSuccess, VerificationFailure, VerificationResult, VerifyPaymentOptions } from "./verify";

export {
  PaymentVerificationError,
  InvalidSignatureError,
  InsufficientBalanceError,
  NonceUsedError,
  PaymentExpiredError,
  PaymentNotYetValidError,
  UnsupportedNetworkError,
  InvalidPayloadError,
} from "./verify";

// X402 payment verification (Coinbase compatible format)
export { verifyX402Payment } from "./verify-x402";

export type {
  X402VerificationSuccess,
  X402VerificationFailure,
  X402VerificationResult,
  X402VerifyOptions,
} from "./verify-x402";

export {
  X402VerificationError,
  X402InvalidSignatureError,
  X402InsufficientBalanceError,
  X402NonceUsedError,
  X402PaymentExpiredError,
  X402PaymentNotYetValidError,
  X402UnsupportedNetworkError,
  X402InvalidPayloadError,
} from "./verify-x402";

// Legacy payment settlement (original Armory format)
export { settlePayment } from "./settle";

export type { SettlementResult, SettlePaymentParams } from "./settle";

export {
  SettlementError,
  InvalidPaymentError,
  NetworkNotFoundError,
  ContractExecutionError,
  AuthorizationExpiredError,
  InvalidSignatureError as SettlementInvalidSignatureError,
  NonceAlreadyUsedError as SettlementNonceAlreadyUsedError,
} from "./settle";

// X402 payment settlement (Coinbase compatible format)
export { settleX402Payment } from "./settle-x402";

export type { X402SettlementResult, X402SettlePaymentParams } from "./settle-x402";

export {
  X402SettlementError,
  X402InvalidPaymentError,
  X402NetworkNotFoundError,
  X402ContractExecutionError,
  X402AuthorizationExpiredError,
  X402InvalidSignatureError as X402SettlementInvalidSignatureError,
  X402NonceAlreadyUsedError as X402SettlementNonceAlreadyUsedError,
} from "./settle-x402";

// Queue management
export type {
  SettleJobId,
  RetryCount,
  SettleJob,
  SettleResult,
  PaymentQueue,
  QueueOptions,
} from "./queue/types";

export { MemoryQueue, createMemoryQueue } from "./queue/memory";

// Nonce tracking
export type { NonceTracker, NonceTrackerOptions, StoredNonce } from "./nonce/types";

export { NonceAlreadyUsedError } from "./nonce/types";

export { MemoryNonceTracker, createNonceTracker } from "./nonce/memory";

// Facilitator server
export { createFacilitatorServer } from "./server";

export type { FacilitatorServerOptions, FacilitatorServer } from "./server";
