// ============================================
// Types from x402 (Coinbase-compatible)
// ============================================

// ============================================
// ERC20 ABI
// ============================================
export type {
  BalanceOfParams,
  BalanceOfReturnType,
  ERC20Abi,
  NameReturnType,
  ReceiveWithAuthorizationParams,
  SymbolReturnType,
  TransferWithAuthorizationParams,
} from "./abi/erc20";
export { ERC20_ABI } from "./abi/erc20";
export {
  runAfterPaymentResponseHooks,
  runBeforeSignPaymentHooks,
  runOnPaymentRequiredHooks,
  selectRequirementWithHooks,
} from "./client-hooks-runtime";
export {
  EURC_BASE,
  getAllTokens,
  getEURCTokens,
  getSKLTokens,
  getToken,
  getTokensByChain,
  getTokensBySymbol,
  getUSDCTokens,
  getUSDTTokens,
  getWBTCTokens,
  getWETHTokens,
  SKL_SKALE_BASE,
  SKL_SKALE_BASE_SEPOLIA,
  TOKENS,
  USDC_BASE,
  USDC_BASE_SEPOLIA,
  USDC_SKALE_BASE,
  USDC_SKALE_BASE_SEPOLIA,
  USDT_SKALE_BASE,
  USDT_SKALE_BASE_SEPOLIA,
  WBTC_SKALE_BASE,
  WBTC_SKALE_BASE_SEPOLIA,
  WETH_SKALE_BASE,
  WETH_SKALE_BASE_SEPOLIA,
} from "./data/tokens";
// ============================================
// EIP-712 utilities
// ============================================
export type {
  EIP712Domain,
  EIP712Types,
  TransferWithAuthorization,
  TypedDataDomain,
  TypedDataField,
} from "./eip712";
export {
  createEIP712Domain,
  createTransferWithAuthorization,
  EIP712_TYPES,
  USDC_DOMAIN,
  validateTransferWithAuthorization,
} from "./eip712";
// ============================================
// Encoding functions (V2 only from encoding.ts)
// ============================================
export {
  decodePaymentV2,
  decodeSettlementV2,
  encodePaymentV2,
  encodeSettlementV2,
  isPaymentV2,
  isSettlementV2,
} from "./encoding";
export type { PaymentRequiredOptions } from "./encoding/x402";
// ============================================
// Encoding utilities from x402
// ============================================
export {
  createPaymentRequiredHeaders,
  createSettlementHeaders,
  decodePayment,
  decodeSettlementResponse,
  decodeX402Response,
  detectPaymentVersion,
  encodePayment,
  encodeSettlementResponse,
  encodeX402Response,
  extractPaymentFromHeaders,
  safeBase64Decode,
  safeBase64Encode,
} from "./encoding/x402";
// ============================================
// Client error classes (shared across all client packages)
// ============================================
export {
  PaymentException,
  SigningError,
  X402ClientError,
} from "./errors";
// ============================================
// Facilitator client
// ============================================
export type {
  FacilitatorClientConfig,
  SupportedKind,
  SupportedResponse,
} from "./payment-client";
export {
  decodePayloadHeader,
  extractPayerAddress,
  getSupported,
  settlePayment,
  verifyPayment,
} from "./payment-client";
export {
  clearFacilitatorCapabilityCache,
  filterExtensionsForFacilitator,
  filterExtensionsForFacilitators,
  filterExtensionsForRequirements,
} from "./facilitator-capabilities";
export type {
  PaymentConfig,
  ResolvedRequirementsConfig,
} from "./payment-requirements";
export {
  createPaymentRequirements,
  enrichPaymentRequirement,
  enrichPaymentRequirements,
  findRequirementByAccepted,
  findRequirementByNetwork,
  resolveFacilitatorUrlFromRequirement,
} from "./payment-requirements";
// ============================================
// Protocol utilities (shared across all client packages)
// ============================================
export {
  calculateValidBefore,
  detectX402Version,
  generateNonce,
  getPaymentHeaderName,
  parseJsonOrBase64,
} from "./protocol";
// ============================================
// Simple types
// ============================================
export type {
  AcceptPaymentOptions,
  ArmoryPaymentResult,
  FacilitatorConfig,
  FacilitatorSettleResult,
  FacilitatorVerifyResult,
  NetworkId,
  PaymentError,
  PaymentErrorCode,
  PaymentResult,
  PayToAddress,
  PricingConfig,
  ResolvedFacilitator,
  ResolvedNetwork,
  ResolvedPaymentConfig,
  ResolvedToken,
  SettlementMode,
  TokenId,
  ValidationError,
} from "./types/api";
// ============================================
// Hook system for extensions
// ============================================
export type {
  BeforePaymentHook,
  ClientHook,
  ClientHookErrorContext,
  ExtensionHook,
  HookConfig,
  HookRegistry,
  HookResult,
  OnPaymentRequiredHook,
  PaymentPayloadContext,
  PaymentRequiredContext,
} from "./types/hooks";
// ============================================
// Network and token configuration
// ============================================
export type { CustomToken, NetworkConfig } from "./types/networks";
export {
  getAllCustomTokens,
  getCustomToken,
  getMainnets,
  getNetworkByChainId,
  getNetworkConfig,
  getTestnets,
  isCustomToken,
  NETWORKS,
  registerToken,
  unregisterToken,
} from "./types/networks";
// ============================================
// Protocol union types and version helpers
// ============================================
export type {
  PaymentPayload,
  PaymentRequired,
  PaymentRequirements,
  SettlementResponse,
} from "./types/protocol";
export {
  getTxHash,
  isSettlementSuccessful,
  isX402V2Payload,
  isX402V2PaymentRequired,
  isX402V2Requirements,
  isX402V2Settlement,
  PAYMENT_REQUIRED_HEADER,
  PAYMENT_RESPONSE_HEADER,
  PAYMENT_SIGNATURE_HEADER,
} from "./types/protocol";
// ============================================
// V2 types and functions (x402 V2 compatible)
// ============================================
export type {
  Address,
  CAIP2Network as CAIP2ChainId,
  CAIPAssetId,
  EIP3009Authorization,
  Extensions,
  PaymentPayloadV2,
  PaymentRequiredV2,
  PaymentRequirementsV2,
  PayToV2,
  ResourceInfo,
  SchemePayloadV2,
  SettlementResponseV2,
  Signature,
} from "./types/v2";
export {
  addressToAssetId,
  assetIdToAddress,
  combineSignature as combineSignatureV2,
  isAddress,
  isCAIP2ChainId,
  isCAIPAssetId,
  isPaymentPayloadV2,
  isPaymentRequiredV2,
  parseSignature as parseSignatureV2,
  V2_HEADERS,
} from "./types/v2";
// ============================================
// Wallet adapter interface
// ============================================
export type { PaymentWallet } from "./types/wallet";
export type {
  Address as X402Address,
  ExactEvmAuthorization,
  ExactEvmPayload,
  Hex,
  Network as X402Network,
  PaymentPayload as X402PaymentPayload,
  PaymentRequirements as X402PaymentRequirements,
  Scheme,
  SettlementResponse as X402SettlementResponse,
  UnsignedPaymentPayload as X402UnsignedPaymentPayload,
  VerifyResponse,
  X402Response,
  X402Version,
} from "./types/x402";
export {
  isExactEvmPayload,
  isPaymentPayload,
  SCHEMES,
  X402_VERSION,
} from "./types/x402";
// ============================================
// Base64 utilities
// ============================================
export {
  decodeBase64ToUtf8,
  encodeUtf8ToBase64,
  normalizeBase64Url,
  toBase64Url,
} from "./utils/base64";
// ============================================
// Route matching utilities
// ============================================
export type {
  ParsedPattern,
  RouteConfig,
  RouteInputConfig,
  RouteMatcher,
  RoutePattern,
  RouteValidationError,
} from "./utils/routes";
export {
  findMatchingRoute,
  matchRoute,
  parseRoutePattern,
  validateRouteConfig,
} from "./utils/routes";
// ============================================
// Utilities from x402
// ============================================
export {
  caip2ToNetwork,
  createNonce,
  fromAtomicUnits,
  getCurrentTimestamp,
  isValidAddress,
  networkToCaip2,
  normalizeAddress,
  toAtomicUnits,
} from "./utils/x402";
// ============================================
// Validation utilities
// ============================================
export {
  checkFacilitatorSupport,
  createError,
  getAvailableNetworks,
  getAvailableTokens,
  isResolvedNetwork,
  isResolvedToken,
  isValidationError,
  normalizeNetworkName,
  resolveFacilitator,
  resolveNetwork,
  resolveToken,
  validateAcceptConfig,
  validatePaymentConfig,
} from "./validation";
