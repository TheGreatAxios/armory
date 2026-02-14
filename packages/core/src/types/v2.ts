/**
 * Armory V2 Types - x402 Protocol V2 Compatible
 *
 * These types match the Coinbase x402 V2 specification for full interoperability.
 * No conversion needed - this is the native format.
 *
 * Specification: https://github.com/coinbase/x402
 */

// ============================================================================
// Base Types
// ============================================================================

export type CAIP2Network = `eip155:${string}`;

export type CAIPAssetId = `eip155:${string}/erc20:${string}`;

export type Address = `0x${string}`;

export interface Signature {
  v: number;
  r: string;
  s: string;
}

export type PayToV2 =
  | Address
  | {
      role?: string;
      callback?: string;
    };

export type PayToAddress = Address | PayToV2;

export interface Extensions {
  [key: string]: unknown;
}

// ============================================================================
// Resource Info
// ============================================================================

/**
 * Resource information describing the protected resource
 */
export interface ResourceInfo {
  /** URL of the protected resource */
  url: string;
  /** Human-readable description of the resource */
  description?: string;
  /** MIME type of the expected response */
  mimeType?: string;
}

// ============================================================================
// Payment Requirements (Server → Client in accepts[] array)
// ============================================================================

/**
 * Payment requirements for a specific payment method
 * Matches x402 V2 PaymentRequirements spec
 */
export interface PaymentRequirementsV2 {
  /** Payment scheme identifier (e.g., "exact") */
  scheme: "exact";
  /** Blockchain network identifier in CAIP-2 format */
  network: CAIP2Network;
  /** Required payment amount in atomic token units */
  amount: string;
  /** Token contract address (extracted from CAIP asset ID) */
  asset: Address;
  /** Recipient wallet address or role constant */
  payTo: Address;
  /** Maximum time allowed for payment completion */
  maxTimeoutSeconds: number;
  /** Scheme-specific additional information (token name, version, etc.) */
  extra?: Extensions;
}

// ============================================================================
// Payment Required Response (Server → Client, 402 status)
// ============================================================================

/**
 * Payment required response (PAYMENT-REQUIRED header)
 * Matches x402 V2 PaymentRequired spec
 */
export interface PaymentRequiredV2 {
  /** Protocol version identifier (must be 2) */
  x402Version: 2;
  /** Human-readable error message */
  error?: string;
  /** Resource being accessed */
  resource: ResourceInfo;
  /** Array of acceptable payment methods */
  accepts: PaymentRequirementsV2[];
  /** Protocol extensions data */
  extensions?: Extensions;
}

// ============================================================================
// EIP-3009 Authorization (for exact scheme on EVM)
// ============================================================================

/**
 * EIP-3009 TransferWithAuthorization authorization data
 * Matches x402 V2 spec for exact scheme
 */
export interface EIP3009Authorization {
  /** Payer's wallet address */
  from: Address;
  /** Recipient's wallet address */
  to: Address;
  /** Payment amount in atomic units */
  value: string;
  /** Unix timestamp when authorization becomes valid */
  validAfter: string;
  /** Unix timestamp when authorization expires */
  validBefore: string;
  /** 32-byte random nonce (bytes32 hex string) */
  nonce: `0x${string}`;
}

/**
 * Scheme-specific payment payload data
 */
export interface SchemePayloadV2 {
  /** Signature for the authorization (0x-prefixed 65-byte hex) */
  signature: `0x${string}`;
  /** EIP-3009 authorization */
  authorization: EIP3009Authorization;
}

// ============================================================================
// Payment Payload (Client → Server, PAYMENT-SIGNATURE header)
// ============================================================================

/**
 * Payment payload sent by client
 * Matches x402 V2 PaymentPayload spec (Coinbase format)
 */
export interface PaymentPayloadV2 {
  /** Protocol version identifier */
  x402Version: 2;
  /** Payment scheme (e.g., "exact") */
  scheme: string;
  /** Network identifier in CAIP-2 format */
  network: string;
  /** Scheme-specific payment data */
  payload: SchemePayloadV2;
  /** Resource being accessed (optional, echoed from server) */
  resource?: ResourceInfo;
  /** Protocol extensions data */
  extensions?: Extensions;
}

// ============================================================================
// Settlement Response (Server → Client, PAYMENT-RESPONSE header)
// ============================================================================

/**
 * Settlement response after payment settlement
 * Matches x402 V2 SettlementResponse spec
 */
export interface SettlementResponseV2 {
  /** Whether settlement was successful */
  success: boolean;
  /** Error reason if settlement failed */
  errorReason?: string;
  /** Address of the payer's wallet */
  payer?: Address;
  /** Blockchain transaction hash (empty if failed) */
  transaction: string;
  /** Blockchain network identifier in CAIP-2 format */
  network: CAIP2Network;
  /** Protocol extensions data */
  extensions?: Extensions;
}

// ============================================================================
// Headers
// ============================================================================

export const V2_HEADERS = {
  PAYMENT_SIGNATURE: "PAYMENT-SIGNATURE",
  PAYMENT_REQUIRED: "PAYMENT-REQUIRED",
  PAYMENT_RESPONSE: "PAYMENT-RESPONSE",
} as const;

// ============================================================================
// Type Guards
// ============================================================================

export function isCAIP2ChainId(value: string): value is CAIP2Network {
  return /^eip155:\d+$/.test(value);
}

export function isCAIPAssetId(value: string): value is CAIPAssetId {
  return /^eip155:\d+\/erc20:0x[a-fA-F0-9]+$/.test(value);
}

export function isAddress(value: string): value is Address {
  return /^0x[a-fA-F0-9]{40}$/.test(value);
}

export function isPaymentRequiredV2(obj: unknown): obj is PaymentRequiredV2 {
  return (
    typeof obj === "object" &&
    obj !== null &&
    "x402Version" in obj &&
    (obj as PaymentRequiredV2).x402Version === 2 &&
    "resource" in obj &&
    "accepts" in obj &&
    Array.isArray((obj as PaymentRequiredV2).accepts)
  );
}

export function isPaymentPayloadV2(obj: unknown): obj is PaymentPayloadV2 {
  return (
    typeof obj === "object" &&
    obj !== null &&
    "x402Version" in obj &&
    (obj as PaymentPayloadV2).x402Version === 2 &&
    "scheme" in obj &&
    "network" in obj &&
    "payload" in obj
  );
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Extract token address from CAIP asset ID
 */
export function assetIdToAddress(assetId: CAIPAssetId): Address {
  const match = assetId.match(/\/erc20:(0x[a-fA-F0-9]{40})$/);
  if (!match) throw new Error(`Invalid CAIP asset ID: ${assetId}`);
  return match[1] as Address;
}

/**
 * Create CAIP asset ID from token address and chain ID
 */
export function addressToAssetId(
  address: Address,
  chainId: string | number
): CAIPAssetId {
  const chain = typeof chainId === "number" ? `eip155:${chainId}` : chainId;
  if (!isCAIP2ChainId(chain)) throw new Error(`Invalid chain ID: ${chain}`);
  return `${chain}/erc20:${address}` as CAIPAssetId;
}

/**
 * Parse combined signature (0x + r + s + v) into components
 */
export function parseSignature(signature: `0x${string}`): Signature {
  const sig = signature.slice(2);
  return {
    r: `0x${sig.slice(0, 64)}`,
    s: `0x${sig.slice(64, 128)}`,
    v: parseInt(sig.slice(128, 130), 16),
  };
}

/**
 * Combine signature components into 65-byte hex string
 */
export function combineSignature(v: number, r: string, s: string): `0x${string}` {
  const rClean = r.startsWith("0x") ? r.slice(2) : r;
  const sClean = s.startsWith("0x") ? s.slice(2) : s;
  const vHex = v.toString(16).padStart(2, "0");
  return `0x${rClean}${sClean}${vHex}` as `0x${string}`;
}
