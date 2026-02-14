/**
 * X402 Protocol Implementation for Viem Client
 *
 * Handles parsing x402 V1 and V2 PAYMENT-REQUIRED headers
 * and generating x402 V1 and V2 PAYMENT-SIGNATURE payloads
 */

import type {
  Account,
  Address,
  Hash,
  TypedData,
  TypedDataDomain,
  WalletClient,
} from "viem";
import type {
  // x402 V1 types
  X402PaymentRequiredV1,
  X402PaymentRequirementsV1,
  X402PaymentPayloadV1,
  X402SchemePayloadV1,
  EIP3009AuthorizationV1,
  // x402 V2 types
  PaymentRequiredV2,
  PaymentRequirementsV2,
  PaymentPayloadV2,
  SchemePayloadV2,
  EIP3009Authorization,
} from "@armory-sh/base";
import {
  V1_HEADERS,
  V2_HEADERS,
  safeBase64Decode,
  isX402V1PaymentRequired,
  isX402V2PaymentRequired,
  getNetworkByChainId,
  getNetworkConfig,
  createEIP712Domain,
  createTransferWithAuthorization,
  EIP712_TYPES,
  normalizeNetworkName,
} from "@armory-sh/base";
import { PaymentError, SigningError } from "./errors";

// ============================================================================
// Type Guards
// ============================================================================

export type X402Wallet =
  | { type: "account"; account: Account }
  | { type: "walletClient"; walletClient: WalletClient };

// ============================================================================
// Version Detection
// ============================================================================

/**
 * Detect x402 protocol version from response headers
 */
export function detectX402Version(response: Response): 1 | 2 {
  const v2Header = response.headers.get(V2_HEADERS.PAYMENT_REQUIRED);
  if (v2Header) {
    try {
      const parsed = JSON.parse(v2Header);
      if (parsed.x402Version === 2) return 2;
    } catch {
      // Continue to V1 check
    }
  }

  const v1Header = response.headers.get(V1_HEADERS.PAYMENT_REQUIRED);
  if (v1Header) {
    try {
      const decoded = safeBase64Decode(v1Header);
      const parsed = JSON.parse(decoded);
      if (parsed.x402Version === 1) return 1;
      return 1;
    } catch {
      // Continue to legacy detection
    }
  }

  return 2;
}

// ============================================================================

export interface ParsedPaymentRequirements {
  version: 1 | 2;
  requirements: X402PaymentRequirementsV1 | PaymentRequirementsV2;
}

export function parsePaymentRequired(response: Response): ParsedPaymentRequirements {
  const version = detectX402Version(response);

  if (version === 2) {
    const v2Header = response.headers.get(V2_HEADERS.PAYMENT_REQUIRED);
    if (!v2Header) {
      throw new PaymentError("No PAYMENT-REQUIRED header found in 402 response");
    }

    try {
      // V2 header is also base64-encoded
      const decoded = safeBase64Decode(v2Header);
      const parsed = JSON.parse(decoded) as PaymentRequiredV2;
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
    const parsed = JSON.parse(decoded) as X402PaymentRequiredV1;
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
// Create x402 Payment Payloads
// ============================================================================

/**
 * Get wallet address from X402Wallet
 */
export function getWalletAddress(wallet: X402Wallet): Address {
  return wallet.type === "account"
    ? wallet.account.address
    : wallet.walletClient.account.address;
}

/**
 * Sign EIP-712 typed data
 */
async function signTypedData(
  wallet: X402Wallet,
  domain: TypedDataDomain,
  types: TypedData,
  message: Record<string, unknown>
): Promise<Hash> {
  if (wallet.type === "account" && !wallet.account.signTypedData) {
    throw new SigningError("Account does not support signTypedData");
  }

  const params = {
    domain,
    types,
    primaryType: 'TransferWithAuthorization' as const,
    message,
  } as const;

  if (wallet.type === "account") {
    return wallet.account.signTypedData(params);
  }

  return wallet.walletClient.signTypedData({
    ...params,
    account: wallet.walletClient.account,
  });
}

/**
 * Parse signature into { v, r, s } components
 */
function parseSignature(signature: Hash): { v: number; r: string; s: string } {
  const sig = signature.slice(2);
  return {
    v: parseInt(sig.slice(128, 130), 16) + 27,
    r: `0x${sig.slice(0, 64)}`,
    s: `0x${sig.slice(64, 128)}`,
  };
}

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
 * Get USDC address for network
 */
function getUsdcAddress(network: string): Address {
  const chainId = extractChainId(network);
  const net = getNetworkByChainId(chainId);
  if (!net) {
    throw new PaymentError(`No network config found for chainId: ${chainId}`);
  }
  return net.usdcAddress;
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
 * Create x402 V1 payment payload
 */
export async function createX402V1Payment(
  wallet: X402Wallet,
  requirements: X402PaymentRequirementsV1,
  fromAddress: Address,
  nonce: `0x${string}`,
  validBefore: number,
  domainName?: string,
  domainVersion?: string
): Promise<X402PaymentPayloadV1> {
  const network = getNetworkSlug(requirements.network);
  const contractAddress = requirements.asset;

  // Create EIP-712 domain
  const domain = createEIP712Domain(extractChainId(requirements.network), contractAddress);
  const customDomain = domainName || domainVersion
    ? { ...domain, name: domainName ?? domain.name, version: domainVersion ?? domain.version }
    : domain;

  const authorization: EIP3009AuthorizationV1 = {
    from: fromAddress,
    to: requirements.payTo,
    value: toAtomicUnits(requirements.maxAmountRequired),
    validAfter: "0",
    validBefore: validBefore.toString(),
    nonce,
  };

  const value = createTransferWithAuthorization({
    from: authorization.from,
    to: authorization.to,
    value: BigInt(authorization.value),
    validAfter: BigInt(authorization.validAfter),
    validBefore: BigInt(authorization.validBefore),
    nonce: BigInt(authorization.nonce),
  });

  const signature = await signTypedData(wallet, customDomain, EIP712_TYPES, value);
  const { v, r, s } = parseSignature(signature);

  const payload: X402SchemePayloadV1 = {
    signature: `0x${r.slice(2)}${s.slice(2)}${v.toString(16).padStart(2, "0")}` as `0x${string}`,
    authorization,
  };

  return {
    x402Version: 1,
    scheme: "exact",
    network,
    payload,
  };
}

/**
 * Create x402 V2 payment payload
 */
export async function createX402V2Payment(
  wallet: X402Wallet,
  requirements: PaymentRequirementsV2,
  fromAddress: Address,
  nonce: `0x${string}`,
  validBefore: number,
  domainName?: string,
  domainVersion?: string
): Promise<PaymentPayloadV2> {
  const contractAddress = requirements.asset;
  const network = requirements.network;

  // Create EIP-712 domain
  const domain = createEIP712Domain(extractChainId(network), contractAddress);
  const customDomain = domainName || domainVersion
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

  const value = createTransferWithAuthorization({
    from: authorization.from,
    to: authorization.to,
    value: BigInt(authorization.value),
    validAfter: BigInt(authorization.validAfter),
    validBefore: BigInt(authorization.validBefore),
    nonce: BigInt(authorization.nonce),
  });

  const signature = await signTypedData(wallet, customDomain, EIP712_TYPES, value);
  const { v, r, s } = parseSignature(signature);

  const payload: SchemePayloadV2 = {
    signature: `0x${r.slice(2)}${s.slice(2)}${v.toString(16).padStart(2, "0")}` as `0x${string}`,
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
 * Create x402 payment payload (auto-detects version)
 */
export async function createX402Payment(
  wallet: X402Wallet,
  parsed: ParsedPaymentRequirements,
  fromAddress: Address,
  nonce: `0x${string}`,
  validBefore: number,
  domainName?: string,
  domainVersion?: string
): Promise<X402PaymentPayloadV1 | PaymentPayloadV2> {
  if (parsed.version === 1) {
    return createX402V1Payment(
      wallet,
      parsed.requirements as X402PaymentRequirementsV1,
      fromAddress,
      nonce,
      validBefore,
      domainName,
      domainVersion
    );
  }

  return createX402V2Payment(
    wallet,
    parsed.requirements as PaymentRequirementsV2,
    fromAddress,
    nonce,
    validBefore,
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
