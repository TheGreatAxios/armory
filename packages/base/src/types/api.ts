/**
 * Simple, developer-friendly API types for Armory
 * Focuses on DX/UX - "everything just magically works"
 */

import type { CustomToken, NetworkConfig } from "./networks";
import type { Address, CAIPAssetId } from "./v2";

// ═══════════════════════════════════════════════════════════════
// Simple API Types
// ═══════════════════════════════════════════════════════════════

/**
 * Network identifier - flexible input that resolves to a chain
 * - Network name: "base", "ethereum", "skale-base"
 * - CAIP-2: "eip155:8453"
 * - Chain ID: 8453
 */
export type NetworkId = string | number;

/**
 * Token identifier - flexible input that resolves to a token
 * - Symbol: "usdc", "eurc", "usdt" (case-insensitive)
 * - CAIP Asset ID: "eip155:8453/erc20:0x..."
 * - Full token config object
 */
export type TokenId = string | CustomToken;

/**
 * Facilitator configuration
 */
export interface FacilitatorConfig {
  /** Facilitator URL for verification/settlement */
  url: string;
  /** Optional authentication headers */
  headers?: () => Record<string, string>;
  /** Networks this facilitator supports (auto-detected if not provided) */
  networks?: NetworkId[];
  /** Tokens this facilitator supports (optional) */
  tokens?: TokenId[];
}

/**
 * Result from facilitator verification
 */
export interface FacilitatorVerifyResult {
  success: boolean;
  payerAddress?: string;
  balance?: string;
  requiredAmount?: string;
  error?: string;
}

/**
 * Result from facilitator settlement
 */
export interface FacilitatorSettleResult {
  success: boolean;
  txHash?: string;
  error?: string;
}

/**
 * Settlement mode - verify only, settle only, or both
 */
export type SettlementMode = "verify" | "settle" | "async";

/**
 * CAIP-2 chain ID type (e.g., eip155:8453)
 */
export type CAIP2ChainId = `eip155:${string}`;

/**
 * CAIP-2 asset ID type (e.g., eip155:8453/erc20:0xa0b8691...)
 */
export type CAIP2AssetId = `eip155:${string}/erc20:${string}`;

/**
 * Payment destination - address, CAIP-2 chain ID, or CAIP asset ID
 */
export type PayToAddress = `0x${string}` | CAIP2ChainId | CAIP2AssetId;

/**
 * Pricing configuration for a specific network/token/facilitator combination
 */
export interface PricingConfig {
  /** Network for this pricing */
  network?: NetworkId;
  /** Token for this pricing */
  token?: TokenId;
  /** Facilitator URL for this pricing (optional - applies to all facilitators if not specified) */
  facilitator?: string;
  /** Amount to charge */
  amount: string;
}

/**
 * Payment accept options for merchants (v2 multi-support)
 */
export interface AcceptPaymentOptions {
  /** Networks to accept payments on */
  networks?: NetworkId[];
  /** Tokens to accept (defaults to ["usdc"]) */
  tokens?: TokenId[];
  /** Facilitator(s) for payment verification/settlement */
  facilitators?: FacilitatorConfig | FacilitatorConfig[];
  /** Protocol version (V2 only) */
  version?: 2;
  /** Pricing configurations - if not provided, uses amount from top-level config */
  pricing?: PricingConfig[];
}

/**
 * Result of a payment attempt
 */
export interface PaymentResult<T = unknown> {
  /** Payment successful */
  success: true;
  /** Response data */
  data: T;
  /** Transaction hash (if settled) */
  txHash?: string;
}

/**
 * Payment error result
 */
export interface PaymentError {
  /** Payment failed */
  success: false;
  /** Error code */
  code: PaymentErrorCode;
  /** Human-readable error message */
  message: string;
  /** Underlying error details */
  details?: unknown;
}

/**
 * Payment error codes
 */
export type PaymentErrorCode =
  | "UNKNOWN_NETWORK"
  | "UNKNOWN_TOKEN"
  | "TOKEN_NOT_ON_NETWORK"
  | "FACILITATOR_UNSUPPORTED"
  | "FACILITATOR_NO_NETWORK_SUPPORT"
  | "FACILITATOR_NO_TOKEN_SUPPORT"
  | "INVALID_CAIP_FORMAT"
  | "CHAIN_MISMATCH"
  | "PAYMENT_REQUIRED"
  | "PAYMENT_DECLINED"
  | "SIGNING_FAILED"
  | "NETWORK_ERROR"
  | "VALIDATION_FAILED";

/**
 * Combined payment result type
 */
export type ArmoryPaymentResult<T = unknown> = PaymentResult<T> | PaymentError;

// ═══════════════════════════════════════════════════════════════
// Resolved Configuration (internal use)
// ═══════════════════════════════════════════════════════════════

/**
 * Fully resolved network configuration
 */
export interface ResolvedNetwork {
  /** Original input */
  input: NetworkId;
  /** Network config */
  config: NetworkConfig;
  /** CAIP-2 ID */
  caip2: `eip155:${string}`;
}

/**
 * Fully resolved token configuration
 */
export interface ResolvedToken {
  /** Original input */
  input: TokenId;
  /** Token config */
  config: CustomToken;
  /** CAIP Asset ID */
  caipAsset: CAIPAssetId;
  /** Network this token is on */
  network: ResolvedNetwork;
}

/**
 * Fully resolved facilitator configuration
 */
export interface ResolvedFacilitator {
  /** Original input */
  input: FacilitatorConfig;
  /** URL */
  url: string;
  /** Supported networks (resolved) */
  networks: ResolvedNetwork[];
  /** Supported tokens (resolved) */
  tokens: ResolvedToken[];
}

/**
 * Fully resolved payment configuration
 */
export interface ResolvedPaymentConfig {
  /** Network to use */
  network: ResolvedNetwork;
  /** Token to use */
  token: ResolvedToken;
  /** Facilitator(s) to use */
  facilitators: ResolvedFacilitator[];
  /** Protocol version (V2 only) */
  version: 2;
  /** Recipient address */
  payTo: Address;
  /** Amount to charge */
  amount: string;
}

/**
 * Validation error details
 */
export interface ValidationError {
  /** Error code */
  code: PaymentErrorCode;
  /** Error message */
  message: string;
  /** Path to the invalid value */
  path?: string;
  /** Invalid value */
  value?: unknown;
  /** Valid options */
  validOptions?: string[];
}

// ═══════════════════════════════════════════════════════════════
// Route Configuration Types
// ═══════════════════════════════════════════════════════════════

/**
 * Route pattern type for matching paths
 */
export type RoutePattern = string;

/**
 * Route matcher function type
 */
export type RouteMatcher = (path: string) => boolean;

/**
 * Route configuration with associated config data
 */
export interface RouteConfig<T = unknown> {
  /** Route pattern (e.g., "/api/users", "/api/*", "/api/users/:id") */
  pattern: RoutePattern;
  /** Configuration associated with this route */
  config: T;
}

/**
 * Parsed route pattern information
 */
export interface ParsedPattern {
  /** Route segments split by "/" */
  segments: string[];
  /** Whether this pattern contains a wildcard */
  isWildcard: boolean;
  /** Whether this pattern contains parameters (e.g., :id) */
  isParametrized: boolean;
  /** Parameter names extracted from the pattern */
  paramNames: string[];
  /** Match priority (higher = more specific) */
  priority: number;
}

/**
 * Route input configuration for middleware
 */
export interface RouteInputConfig {
  /** Single exact route (no wildcards allowed) */
  route?: string;
  /** Multiple routes (allows wildcards) */
  routes?: string[];
}

/**
 * Route-specific validation error details
 */
export interface RouteValidationError {
  /** Error code (custom string, not PaymentErrorCode) */
  code: string;
  /** Error message */
  message: string;
  /** Path to the invalid value */
  path?: string;
  /** Invalid value */
  value?: unknown;
  /** Valid options */
  validOptions?: string[];
}
