/**
 * X402 Protocol Implementation for Ethers Client
 *
 * Handles parsing x402 V1 and V2 PAYMENT-REQUIRED headers
 * and generating x402 V1 and V2 PAYMENT-SIGNATURE payloads
 */

import type { Signer } from "ethers";
import type {
  // x402 V1 types
  X402PaymentRequirementsV1,
  X402PaymentPayloadV1,
  X402SchemePayloadV1,
  EIP3009AuthorizationV1,
  // x402 V2 types
  PaymentRequirementsV2,
  PaymentPayloadV2,
  SchemePayloadV2,
  EIP3009Authorization,
  Address,
} from "@armory-sh/base";
import {
  V1_HEADERS,
  V2_HEADERS,
  safeBase64Decode,
  isX402V1PaymentRequired,
  isX402V2PaymentRequired,
  isX402V1Requirements,
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
// Version Detection
// ============================================================================

/**
 * Detect x402 protocol version from response headers
 */
export function detectX402Version(response: Response): 1 | 2 {
  // Check for x402 V2 PAYMENT-REQUIRED header first
  const v2Header = response.headers.get(V2_HEADERS.PAYMENT_REQUIRED);
  if (v2Header) {
    try {
      const parsed = JSON.parse(v2Header);
      if (parsed.x402Version === 2) return 2;
    } catch {
      // Continue to V1 check
    }
  }

  // Check for x402 V1 X-PAYMENT-REQUIRED header
  const v1Header = response.headers.get(V1_HEADERS.PAYMENT_REQUIRED);
  if (v1Header) {
    try {
      const decoded = safeBase64Decode(v1Header);
      const parsed = JSON.parse(decoded);
      if (parsed.x402Version === 1) return 1;
      // Legacy format without x402Version defaults to V1
      return 1;
    } catch {
      // Continue to legacy detection
    }
  }

  // Default to V2 for new implementations
  return 2;
}

// ============================================================================
// Parse Payment Requirements
// ============================================================================

/**
 * Parsed payment requirements with version info
 */
export interface ParsedPaymentRequirements {
  version: 1 | 2;
  requirements: X402PaymentRequirementsV1 | PaymentRequirementsV2;
}

/**
 * Parse x402 PAYMENT-REQUIRED header from response
 * Automatically detects V1 or V2 format
 */
export function parsePaymentRequired(response: Response): ParsedPaymentRequirements {
  const version = detectX402Version(response);

  if (version === 2) {
    const v2Header = response.headers.get(V2_HEADERS.PAYMENT_REQUIRED);
    if (!v2Header) {
      throw new PaymentError("No PAYMENT-REQUIRED header found in 402 response");
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

  // V1
  const v1Header = response.headers.get(V1_HEADERS.PAYMENT_REQUIRED);
  if (!v1Header) {
    throw new PaymentError("No X-PAYMENT-REQUIRED header found in 402 response");
  }

  try {
    const decoded = safeBase64Decode(v1Header);
    const parsed = JSON.parse(decoded);
    if (!isX402V1PaymentRequired(parsed)) {
      throw new PaymentError("Invalid x402 V1 payment required format");
    }
    if (!parsed.accepts || parsed.accepts.length === 0) {
      throw new PaymentError("No payment requirements found in accepts array");
    }
    return {
      version: 1,
      requirements: parsed.accepts[0],
    };
  } catch (error) {
    if (error instanceof PaymentError) throw error;
    throw new PaymentError(`Failed to parse V1 PAYMENT-REQUIRED header: ${error}`);
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
 * Supports both CAIP-2 format (eip155:84532) and network names (base-sepolia)
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

// ============================================================================
// Create x402 V1 Payment Payload
// ============================================================================

/**
 * Create x402 V1 payment payload
 */
export async function createX402V1Payment(
  signer: Signer,
  requirements: X402PaymentRequirementsV1,
  fromAddress: Address,
  nonce: `0x${string}`,
  validBefore: number,
  domainName?: string,
  domainVersion?: string
): Promise<X402PaymentPayloadV1> {
  const network = getNetworkSlug(requirements.network);
  const contractAddress = requirements.asset;
  const chainId = extractChainId(requirements.network);

  // Create EIP-712 domain
  const domain = createEIP712Domain(chainId, contractAddress);
  const customDomain: EIP712Domain = domainName || domainVersion
    ? { ...domain, name: domainName ?? domain.name, version: domainVersion ?? domain.version }
    : domain;

  // Create EIP-3009 authorization
  const authorization: EIP3009AuthorizationV1 = {
    from: fromAddress,
    to: requirements.payTo,
    value: toAtomicUnits(requirements.maxAmountRequired),
    validAfter: "0",
    validBefore: validBefore.toString(),
    nonce,
  };

  // Sign the authorization
  const authParams: TransferWithAuthorizationParams = {
    from: authorization.from,
    to: authorization.to,
    value: BigInt(authorization.value),
    validAfter: BigInt(authorization.validAfter),
    validBefore: BigInt(authorization.validBefore),
    nonce: BigInt(authorization.nonce),
  };

  const signature = await signEIP3009(signer, authParams, customDomain);

  // Combine signature into 65-byte hex
  const combinedSignature = `0x${signature.r.slice(2)}${signature.s.slice(2)}${signature.v.toString(16).padStart(2, "0")}` as `0x${string}`;

  const payload: X402SchemePayloadV1 = {
    signature: combinedSignature,
    authorization,
  };

  return {
    x402Version: 1,
    scheme: "exact",
    network,
    payload,
  };
}

// ============================================================================
// Create x402 V2 Payment Payload
// ============================================================================

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

  // Create EIP-712 domain
  const domain = createEIP712Domain(chainId, contractAddress);
  const customDomain: EIP712Domain = domainName || domainVersion
    ? { ...domain, name: domainName ?? domain.name, version: domainVersion ?? domain.version }
    : domain;

  // Create EIP-3009 authorization
  const authorization: EIP3009Authorization = {
    from: fromAddress,
    to: requirements.payTo,
    value: toAtomicUnits(requirements.amount),
    validAfter: "0",
    validBefore: validBefore.toString(),
    nonce,
  };

  // Sign the authorization
  const authParams: TransferWithAuthorizationParams = {
    from: authorization.from,
    to: authorization.to,
    value: BigInt(authorization.value),
    validAfter: BigInt(authorization.validAfter),
    validBefore: BigInt(authorization.validBefore),
    nonce: BigInt(authorization.nonce),
  };

  const signature = await signEIP3009(signer, authParams, customDomain);

  // Combine signature into 65-byte hex
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

// ============================================================================
// Create x402 Payment (Auto-detect version)
// ============================================================================

/**
 * Create x402 payment payload (auto-detects version)
 */
export async function createX402Payment(
  signer: Signer,
  parsed: ParsedPaymentRequirements,
  fromAddress: Address,
  nonce?: `0x${string}`,
  validBefore?: number,
  domainName?: string,
  domainVersion?: string
): Promise<X402PaymentPayloadV1 | PaymentPayloadV2> {
  const effectiveNonce = nonce ?? createNonce();
  const effectiveValidBefore = validBefore ?? Math.floor(Date.now() / 1000) + 3600;

  if (parsed.version === 1) {
    return createX402V1Payment(
      signer,
      parsed.requirements as X402PaymentRequirementsV1,
      fromAddress,
      effectiveNonce,
      effectiveValidBefore,
      domainName,
      domainVersion
    );
  }

  return createX402V2Payment(
    signer,
    parsed.requirements as PaymentRequirementsV2,
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
export function encodeX402Payment(payload: X402PaymentPayloadV1 | PaymentPayloadV2): string {
  return Buffer.from(JSON.stringify(payload)).toString("base64");
}

/**
 * Get the correct header name for payment based on version
 */
export function getPaymentHeaderName(version: 1 | 2): string {
  return version === 1 ? V1_HEADERS.PAYMENT : V2_HEADERS.PAYMENT_SIGNATURE;
}

// ============================================================================
// Legacy Compatibility (deprecated)
// ============================================================================

/**
 * @deprecated Use createX402Payment instead
 */
export async function createPaymentPayload(
  requirements: unknown,
  signer: Signer,
  from: string
): Promise<[string, string]> {
  // Convert legacy requirements to parsed format
  const parsed: ParsedPaymentRequirements = isX402V1Requirements(requirements)
    ? { version: 1, requirements: requirements as X402PaymentRequirementsV1 }
    : { version: 2, requirements: requirements as PaymentRequirementsV2 };

  const payload = await createX402Payment(signer, parsed, from as Address);
  const encoded = encodeX402Payment(payload);

  return [encoded, getPaymentHeaderName(parsed.version)];
}

/**
 * @deprecated Use parsePaymentRequired instead
 */
export async function parsePaymentRequirements(response: Response): Promise<unknown> {
  const parsed = parsePaymentRequired(response);
  return parsed.requirements;
}

/**
 * @deprecated Use detectX402Version instead
 */
export function detectProtocolVersion(requirements: unknown): 1 | 2 {
  // Check for x402 V2 format (has x402Version === 2)
  if (typeof requirements === "object" && requirements !== null) {
    if ("x402Version" in requirements && (requirements as { x402Version: number }).x402Version === 2) {
      return 2;
    }
    // Check for legacy V2 format (has chainId/assetId, no contractAddress)
    if ("chainId" in requirements && "assetId" in requirements && !("contractAddress" in requirements)) {
      return 2;
    }
  }
  return 1;
}
