/**
 * Simple, developer-friendly API types for Armory
 * Focuses on DX/UX - "everything just magically works"
 */

import type { Address, CAIPAssetId } from "./v2";
import type { NetworkConfig, CustomToken } from "./networks";

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
  /** Protocol version (default: auto-detect) */
  version?: 1 | 2 | "auto";
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
  /** Protocol version */
  version: 1 | 2 | "auto";
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
