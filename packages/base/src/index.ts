// ============================================
// Types from x402 (Coinbase-compatible)
// ============================================
export type {
  Address as X402Address,
  Hex,
  X402Version,
  Scheme,
  Network as X402Network,
  ExactEvmAuthorization,
  ExactEvmPayload,
  PaymentPayload as X402PaymentPayload,
  UnsignedPaymentPayload as X402UnsignedPaymentPayload,
  PaymentRequirements as X402PaymentRequirements,
  SettlementResponse as X402SettlementResponse,
  VerifyResponse,
  X402Response,
  PaymentPayloadV2 as X402PayloadV2,
  LegacyPaymentPayload as X402LegacyPayload,
} from "./types/x402";

export {
  X402_VERSION,
  SCHEMES,
  isPaymentPayload,
  isExactEvmPayload,
  legacyToPaymentPayload,
} from "./types/x402";

// ============================================
// Encoding utilities from x402
// ============================================
export {
  safeBase64Encode,
  safeBase64Decode,
  encodePayment,
  decodePayment,
  encodeSettlementResponse,
  decodeSettlementResponse,
  encodeX402Response,
  decodeX402Response,
  detectPaymentVersion,
  extractPaymentFromHeaders,
  createPaymentRequiredHeaders,
  createSettlementHeaders,
  isLegacyV2,
} from "./encoding/x402";

// ============================================
// Utilities from x402
// ============================================
export {
  createNonce,
  toAtomicUnits,
  fromAtomicUnits,
  caip2ToNetwork,
  networkToCaip2,
  getCurrentTimestamp,
  isValidAddress,
  normalizeAddress,
} from "./utils/x402";

// ============================================
// V2 types and functions (x402 V2 compatible)
// ============================================
export type {
  CAIP2Network as CAIP2ChainId,
  CAIPAssetId,
  Address,
  Signature,
  PayToV2,
  Extensions,
  PaymentPayloadV2,
  PaymentRequirementsV2,
  SettlementResponseV2,
  PaymentRequiredV2,
  ResourceInfo,
  EIP3009Authorization,
  SchemePayloadV2,
} from "./types/v2";

export {
  V2_HEADERS,
  isCAIP2ChainId,
  isCAIPAssetId,
  isAddress,
  isPaymentRequiredV2,
  isPaymentPayloadV2,
  assetIdToAddress,
  addressToAssetId,
  parseSignature as parseSignatureV2,
  combineSignature as combineSignatureV2,
} from "./types/v2";

// ============================================
// Protocol union types and version helpers
// ============================================
export type {
  PaymentPayload,
  PaymentRequirements,
  SettlementResponse,
  PaymentRequired,
} from "./types/protocol";

export {
  isX402V2Payload,
  isX402V2Requirements,
  isX402V2Settlement,
  isX402V2PaymentRequired,
  isLegacyV2Payload,
  isSettlementSuccessful,
  getTxHash,
  PAYMENT_SIGNATURE_HEADER,
  PAYMENT_RESPONSE_HEADER,
  PAYMENT_REQUIRED_HEADER,
} from "./types/protocol";

// ============================================
// Network and token configuration
// ============================================
export type { NetworkConfig, CustomToken } from "./types/networks";

export {
  NETWORKS,
  getNetworkConfig,
  getNetworkByChainId,
  getMainnets,
  getTestnets,
  registerToken,
  getCustomToken,
  getAllCustomTokens,
  unregisterToken,
  isCustomToken,
} from "./types/networks";

// ============================================
// ERC20 ABI
// ============================================
export type {
  TransferWithAuthorizationParams,
  ReceiveWithAuthorizationParams,
  BalanceOfParams,
  BalanceOfReturnType,
  NameReturnType,
  SymbolReturnType,
  ERC20Abi,
} from "./abi/erc20";

export { ERC20_ABI } from "./abi/erc20";

// ============================================
// EIP-712 utilities
// ============================================
export type {
  TypedDataDomain,
  EIP712Domain,
  TransferWithAuthorization,
  TypedDataField,
  EIP712Types,
} from "./eip712";

export {
  EIP712_TYPES,
  USDC_DOMAIN,
  createEIP712Domain,
  createTransferWithAuthorization,
  validateTransferWithAuthorization,
} from "./eip712";

// ============================================
// Validation utilities
// ============================================
export {
  resolveNetwork,
  resolveToken,
  resolveFacilitator,
  checkFacilitatorSupport,
  validatePaymentConfig,
  validateAcceptConfig,
  getAvailableNetworks,
  getAvailableTokens,
  isValidationError,
  isResolvedNetwork,
  isResolvedToken,
  createError,
  normalizeNetworkName,
} from "./validation";

// ============================================
// Encoding functions (V2 only from encoding.ts)
// ============================================
export {
  encodePaymentV2,
  decodePaymentV2,
  encodeSettlementV2,
  decodeSettlementV2,
  isPaymentV2,
  isSettlementV2,
} from "./encoding";

// ============================================
// Simple types
// ============================================
export type {
  NetworkId,
  TokenId,
  FacilitatorConfig,
  FacilitatorVerifyResult,
  FacilitatorSettleResult,
  SettlementMode,
  PayToAddress,
  AcceptPaymentOptions,
  PricingConfig,
  PaymentResult,
  PaymentError,
  PaymentErrorCode,
  ArmoryPaymentResult,
  ResolvedNetwork,
  ResolvedToken,
  ResolvedFacilitator,
  ResolvedPaymentConfig,
  ValidationError,
} from "./types/api";

// ============================================
// Fixtures for testing
// ============================================
export {
  createX402V2Payload,
  createLegacyV2Payload,
  INVALID_PAYLOADS,
  TEST_PAYER_ADDRESS,
  TEST_PAY_TO_ADDRESS,
  TEST_CONTRACT_ADDRESS,
  TEST_PRIVATE_KEY,
} from "./fixtures/payloads";

export { DEFAULT_PAYMENT_CONFIG, type TestPaymentConfig } from "./fixtures/config";
