/**
 * X402 Protocol Implementation for Ethers Client (V2 Only)
 *
 * Handles parsing x402 V2 PAYMENT-REQUIRED headers
 * and generating x402 V2 PAYMENT-SIGNATURE payloads
 */

import type { Signer } from "ethers";
import type {
  // x402 V2 types
  PaymentRequirementsV2,
  PaymentPayloadV2,
  SchemePayloadV2,
  EIP3009Authorization,
  Address,
} from "@armory-sh/base";
import {
  V2_HEADERS,
  isX402V2PaymentRequired,
  getNetworkByChainId,
  getNetworkConfig,
  createEIP712Domain,
  createTransferWithAuthorization,
  EIP712_TYPES,
  normalizeNetworkName,
  type TransferWithAuthorization,
} from "@armory-sh/base";
import type { TransferWithAuthorizationParams, EIP712Domain } from "./types";
import { signEIP3009 } from "./eip3009";
import { PaymentError } from "./errors";

// ============================================================================
// Version Detection (V2 Only)
// ============================================================================

/**
 * Detect x402 protocol version from response headers
 * V2-only: Always returns 2
 */
export function detectX402Version(_response: Response): 2 {
  return 2;
}

/**
 * Get payment header name for protocol version
 */
export function getPaymentHeaderName(_version: 2): string {
  return V2_HEADERS.PAYMENT_SIGNATURE;
}

// ============================================================================

export interface ParsedPaymentRequirements {
  version: 2;
  requirements: PaymentRequirementsV2;
}

/**
 * Parse x402 PAYMENT-REQUIRED header from response
 * V2 only
 */
export function parsePaymentRequired(response: Response): ParsedPaymentRequirements {
  const v2Header = response.headers.get(V2_HEADERS.PAYMENT_REQUIRED);
  if (!v2Header) {
    throw new PaymentError("No PAYMENT-REQUIRED header found in V2 response");
  }

  try {
    const parsed = JSON.parse(v2Header);
    if (!isX402V2PaymentRequired(parsed)) {
      throw new PaymentError("Invalid x402 V2 payment required format");
    }
    if (!parsed.accepts || parsed.accepts.length === 0) {
      throw new PaymentError("No payment requirements found in accepts array");
    }
    return {
      version: 2,
      requirements: parsed.accepts[0],
    };
  } catch (error) {
    if (error instanceof PaymentError) throw error;
    throw new PaymentError(`Failed to parse V2 PAYMENT-REQUIRED header: ${error}`);
  }
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Convert amount (string like "1.0") to atomic units (string like "1000000")
 */
function toAtomicUnits(amount: string): string {
  return Math.floor(parseFloat(amount) * 1e6).toString();
}

/**
 * Extract chain ID from network identifier
 * Supports CAIP-2 format (eip155:84532) and network names (base-sepolia)
 */
function extractChainId(network: string): number {
  if (network.startsWith("eip155:")) {
    return parseInt(network.split(":")[1], 10);
  }

  const net = getNetworkConfig(normalizeNetworkName(network));
  if (net) {
    return net.chainId;
  }

  throw new PaymentError(`Unsupported network: ${network}`);
}

/**
 * Get network slug (e.g., "base-sepolia") from CAIP-2 or network name
 */
function getNetworkSlug(network: string): string {
  if (network.startsWith("eip155:")) {
    const chainId = parseInt(network.split(":")[1], 10);
    const net = getNetworkByChainId(chainId);
    if (!net) {
      throw new PaymentError(`No network config found for chainId: ${chainId}`);
    }
    return normalizeNetworkName(net.name);
  }
  return normalizeNetworkName(network);
}

/**
 * Create nonce as hex string
 */
function createNonce(): `0x${string}` {
  const now = Math.floor(Date.now() / 1000);
  return `0x${(now * 1000).toString(16).padStart(64, "0")}` as `0x${string}`;
}

/**
 * Create x402 V2 payment payload
 */
export async function createX402V2Payment(
  signer: Signer,
  requirements: PaymentRequirementsV2,
  fromAddress: Address,
  nonce: `0x${string}`,
  validBefore: number,
  domainName?: string,
  domainVersion?: string
): Promise<PaymentPayloadV2> {
  const contractAddress = requirements.asset;
  const chainId = extractChainId(requirements.network);

  const domain = createEIP712Domain(chainId, contractAddress);
  const customDomain: EIP712Domain = domainName || domainVersion
    ? { ...domain, name: domainName ?? domain.name, version: domainVersion ?? domain.version }
    : domain;

  const authorization: EIP3009Authorization = {
    from: fromAddress,
    to: requirements.payTo,
    value: toAtomicUnits(requirements.amount),
    validAfter: "0",
    validBefore: validBefore.toString(),
    nonce,
  };

  const authParams: TransferWithAuthorizationParams = {
    from: authorization.from,
    to: authorization.to,
    value: BigInt(authorization.value),
    validAfter: BigInt(authorization.validAfter),
    validBefore: BigInt(authorization.validBefore),
    nonce: BigInt(authorization.nonce),
  };

  const signature = await signEIP3009(signer, authParams, customDomain);

  const combinedSignature = `0x${signature.r.slice(2)}${signature.s.slice(2)}${signature.v.toString(16).padStart(2, "0")}` as `0x${string}`;

  const payload: SchemePayloadV2 = {
    signature: combinedSignature,
    authorization,
  };

  return {
    x402Version: 2,
    scheme: requirements.scheme,
    network: requirements.network,
    payload,
  };
}

/**
 * Create x402 payment payload (V2-only wrapper)
 */
export async function createX402Payment(
  signer: Signer,
  parsed: ParsedPaymentRequirements,
  fromAddress: Address,
  nonce?: `0x${string}`,
  validBefore?: number,
  domainName?: string,
  domainVersion?: string
): Promise<PaymentPayloadV2> {
  const effectiveNonce = nonce ?? createNonce();
  const effectiveValidBefore = validBefore ?? Math.floor(Date.now() / 1000) + 3600;

  return createX402V2Payment(
    signer,
    parsed.requirements,
    fromAddress,
    effectiveNonce,
    effectiveValidBefore,
    domainName,
    domainVersion
  );
}

// ============================================================================
// Encoding Helpers
// ============================================================================

/**
 * Encode x402 payment payload to Base64 for transport
 */
export function encodeX402Payment(payload: PaymentPayloadV2): string {
  return Buffer.from(JSON.stringify(payload)).toString("base64");
}
