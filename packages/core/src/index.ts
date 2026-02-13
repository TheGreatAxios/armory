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
  PaymentPayloadV1 as X402PayloadV1,
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
  X402_HEADERS,
  detectPaymentVersion,
  extractPaymentFromHeaders,
  createPaymentRequiredHeaders,
  createSettlementHeaders,
  isLegacyV1,
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
// Legacy V1 types and functions (x402 V1 compatible)
// ============================================
export type {
  PaymentPayloadV1,
  PaymentRequirementsV1,
  SettlementResponseV1,
  X402PaymentPayloadV1,
  X402PaymentRequiredV1,
  X402PaymentRequirementsV1,
  X402SettlementResponseV1,
  X402SchemePayloadV1,
  EIP3009AuthorizationV1,
  LegacyPaymentPayloadV1,
  LegacyPaymentRequirementsV1,
  LegacySettlementResponseV1,
} from "./types/v1";

export {
  V1_HEADERS,
  encodeX402PaymentRequiredV1,
  decodeX402PaymentRequiredV1,
  encodeX402PaymentPayloadV1,
  decodeX402PaymentPayloadV1,
  encodeX402SettlementResponseV1,
  decodeX402SettlementResponseV1,
  isX402PaymentRequiredV1,
  isX402PaymentPayloadV1,
  isLegacyPaymentPayloadV1,
} from "./types/v1";

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
  isV1,
  isV2,
  isX402V1Payload,
  isX402V2Payload,
  isLegacyV1Payload,
  isX402V1Requirements,
  isX402V2Requirements,
  isX402V1Settlement,
  isX402V2Settlement,
  isX402V1PaymentRequired,
  isX402V2PaymentRequired,
  getPaymentVersion,
  getRequirementsVersion,
  getSettlementVersion,
  getPaymentRequiredVersion,
  getPaymentHeaderName,
  getPaymentResponseHeaderName,
  getPaymentRequiredHeaderName,
  isSettlementSuccessful,
  getTxHash,
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
// Legacy encoding functions (from encoding.ts)
// ============================================
export {
  encodePaymentV1,
  decodePaymentV1,
  encodeSettlementV1,
  decodeSettlementV1,
  encodePaymentV2,
  decodePaymentV2,
  encodeSettlementV2,
  decodeSettlementV2,
  detectPaymentVersion as detectPaymentVersionLegacy,
  decodePayment as decodePaymentLegacy,
  decodeSettlement as decodeSettlementLegacy,
  isPaymentV1,
  isPaymentV2,
  isSettlementV1,
  isSettlementV2,
} from "./encoding";

// ============================================
// Simple types
// ============================================
export type {
  NetworkId,
  TokenId,
  FacilitatorConfig,
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
} from "./types/simple";
