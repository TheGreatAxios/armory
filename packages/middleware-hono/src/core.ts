import type {
  PaymentRequirements,
  SettlementResponseV1,
  CustomToken,
  // x402 V1 types
  X402PaymentRequiredV1,
  X402PaymentRequirementsV1,
  X402SettlementResponseV1,
  // x402 V2 types
  PaymentRequiredV2,
  PaymentRequirementsV2,
  SettlementResponseV2,
  ResourceInfo,
} from "@armory-sh/base";
import {
  getNetworkConfig,
  getNetworkByChainId,
  normalizeNetworkName,
  getCustomToken,
  // x402 V1 encoding
  encodeX402PaymentRequiredV1,
  encodeX402SettlementResponseV1,
  // x402 V2 encoding
  safeBase64Encode,
  V1_HEADERS,
  V2_HEADERS,
} from "@armory-sh/base";
import type {
  MiddlewareConfig,
  FacilitatorConfig,
  FacilitatorVerifyResult,
  FacilitatorSettleResult,
  HttpRequest,
} from "./types";

/**
 * Convert eip155 format to slug, or slug to slug (no-op)
 * Handles both "eip155:84532" and "base-sepolia" inputs
 */
const toSlug = (network: string | number): string => {
  if (typeof network === "number") {
    const net = getNetworkByChainId(network);
    if (!net) throw new Error(`No network found for chainId: ${network}`);
    return normalizeNetworkName(net.name);
  }

  // Handle eip155 format input
  if (network.startsWith("eip155:")) {
    const chainIdStr = network.split(":")[1];
    if (!chainIdStr) throw new Error(`Invalid eip155 format: ${network}`);
    const chainId = parseInt(chainIdStr, 10);
    const net = getNetworkByChainId(chainId);
    if (!net) throw new Error(`No network found for chainId: ${chainId}`);
    return normalizeNetworkName(net.name);
  }

  return normalizeNetworkName(network);
};

/**
 * Convert slug to eip155 format
 */
const toEip155 = (network: string | number): string => {
  if (typeof network === "number") {
    const net = getNetworkByChainId(network);
    if (!net) throw new Error(`No network found for chainId: ${network}`);
    return net.caip2Id;
  }

  // Already in eip155 format
  if (network.startsWith("eip155:")) {
    const net = getNetworkConfig(network);
    if (!net) throw new Error(`No network found for: ${network}`);
    return net.caip2Id;
  }

  // Slug input - convert to eip155
  const slug = normalizeNetworkName(network);
  const net = getNetworkConfig(slug);
  if (!net) throw new Error(`No network found for: ${slug}`);
  return net.caip2Id;
};

const getNetworkName = (network: string | number): string => toSlug(network);

const getChainId = (network: string | number): string => toEip155(network);

const createV1Requirements = (
  config: MiddlewareConfig,
  resourceUrl: string,
  expiry: number
): X402PaymentRequirementsV1 => {
  const networkName = getNetworkName(config.network);
  const network = getNetworkConfig(networkName);
  if (!network) throw new Error(`Unsupported network: ${networkName}`);

  // Convert amount to atomic units (USDC has 6 decimals)
  const atomicAmount = toAtomicUnits(config.amount);

  return {
    scheme: "exact",
    network: networkName,
    maxAmountRequired: atomicAmount,
    asset: network.usdcAddress as `0x${string}`,
    payTo: config.payTo as `0x${string}`,
    resource: resourceUrl,
    description: "API Access",
    mimeType: "application/json",
    maxTimeoutSeconds: 300,
    extra: {
      name: "USDC",
      version: "2",
    },
  };
};

/**
 * Convert decimal amount to atomic units (6 decimals for USDC)
 */
const toAtomicUnits = (amount: string): string => {
  if (amount.includes(".")) {
    const [whole, fractional = ""] = amount.split(".");
    const paddedFractional = fractional.padEnd(6, "0").slice(0, 6);
    return `${whole}${paddedFractional}`.replace(/^0+/, "") || "0";
  }
  return `${amount}000000`;
};

const createV2Requirements = (
  config: MiddlewareConfig,
  resourceUrl: string,
  token?: CustomToken
): PaymentRequirementsV2 => {
  const networkName = getNetworkName(config.network);
  const network = getNetworkConfig(networkName);
  if (!network) throw new Error(`Unsupported network: ${networkName}`);

  // Extract token address from CAIP asset ID for x402 V2 format
  // The asset ID format is eip155:xxx/erc20:0x... - extract the address part
  const assetIdMatch = network.caipAssetId.match(/\/erc20:(0x[a-fA-F0-9]{40})$/);
  if (!assetIdMatch) throw new Error(`Invalid CAIP asset ID format: ${network.caipAssetId}`);
  const asset = assetIdMatch[1] as `0x${string}`;

  // Get token name and version from provided token or registry
  let tokenName = "USD Coin";
  let tokenVersion = "2";

  if (token) {
    tokenName = token.name;
    tokenVersion = token.version;
  } else {
    const registeredToken = getCustomToken(network.chainId, asset);
    if (registeredToken) {
      tokenName = registeredToken.name;
      tokenVersion = registeredToken.version;
    }
  }

  // Convert amount to atomic units (USDC has 6 decimals)
  const atomicAmount = toAtomicUnits(config.amount);

  return {
    scheme: "exact",
    network: getChainId(config.network) as `eip155:${string}`,
    amount: atomicAmount,
    asset,
    payTo: config.payTo as `0x${string}`,
    maxTimeoutSeconds: 300,
    extra: {
      name: tokenName,
      version: tokenVersion,
    },
  };
};

export const createPaymentRequirements = (
  config: MiddlewareConfig,
  version: 1 | 2 = 1,
  resourceUrl: string = "https://api.example.com",
  token?: CustomToken
): PaymentRequirements => {
  const networkName = getNetworkName(config.network);
  const network = getNetworkConfig(networkName);
  if (!network) throw new Error(`Unsupported network: ${networkName}`);
  const expiry = Math.floor(Date.now() / 1000) + 3600;

  return version === 1
    ? createV1Requirements(config, resourceUrl, expiry)
    : createV2Requirements(config, resourceUrl, token);
};

const findHeaderValue = (
  headers: Record<string, string | string[] | undefined>,
  name: string
): string | undefined => {
  const value = headers[name];
  if (typeof value === "string") return value;
  if (Array.isArray(value) && value.length > 0) return value[0];

  const lowerName = name.toLowerCase();
  for (const [key, val] of Object.entries(headers)) {
    if (key.toLowerCase() === lowerName) {
      if (typeof val === "string") return val;
      if (Array.isArray(val) && val.length > 0) return val[0];
    }
  }
  return undefined;
};

const parseHeader = (header: string): Record<string, unknown> | null => {
  try {
    if (header.startsWith("{")) return JSON.parse(header);
    return JSON.parse(atob(header));
  } catch {
    return null;
  }
};

const extractPaymentPayload = (request: HttpRequest): Record<string, unknown> | null => {
  const v1Header = findHeaderValue(request.headers, "X-PAYMENT");
  if (v1Header) return parseHeader(v1Header);

  const v2Header = findHeaderValue(request.headers, "PAYMENT-SIGNATURE");
  if (v2Header) return parseHeader(v2Header);

  return null;
};

const postFacilitator = async (
  url: string,
  headers: Record<string, string>,
  body: unknown
): Promise<unknown> => {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error || `Request failed: ${response.status}`);
  }

  return response.json();
};

export const verifyWithFacilitator = async (
  request: HttpRequest,
  facilitator: FacilitatorConfig
): Promise<FacilitatorVerifyResult> => {
  const payload = extractPaymentPayload(request);
  if (!payload) {
    return { success: false, error: "No payment payload found in request headers" };
  }

  try {
    const url = new URL("/verify", facilitator.url);
    const headers = facilitator.createHeaders?.() ?? {};
    const data = await postFacilitator(url.toString(), headers, { payload, headers: request.headers });

    return {
      success: true,
      payerAddress: (data as { payerAddress?: string }).payerAddress,
      balance: (data as { balance?: string }).balance,
      requiredAmount: (data as { requiredAmount?: string }).requiredAmount,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown verification error",
    };
  }
};

export const settleWithFacilitator = async (
  request: HttpRequest,
  facilitator: FacilitatorConfig
): Promise<FacilitatorSettleResult> => {
  const payload = extractPaymentPayload(request);
  if (!payload) {
    return { success: false, error: "No payment payload found in request headers" };
  }

  try {
    const url = new URL("/settle", facilitator.url);
    const headers = facilitator.createHeaders?.() ?? {};
    const data = await postFacilitator(url.toString(), headers, { payload, headers: request.headers });

    return {
      success: true,
      txHash: (data as { txHash?: string }).txHash,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown settlement error",
    };
  }
};

/**
 * Create x402 V1 PaymentRequired headers
 * Matches x402 V1 spec format with x402Version: 1
 */
export const createX402V1PaymentRequiredHeaders = (
  requirements: X402PaymentRequirementsV1,
  errorMessage: string = "X-PAYMENT header is required"
): Record<string, string> => {
  const paymentRequired: X402PaymentRequiredV1 = {
    x402Version: 1,
    error: errorMessage,
    accepts: [requirements],
  };
  return {
    [V1_HEADERS.PAYMENT_REQUIRED]: encodeX402PaymentRequiredV1(paymentRequired),
    "Content-Type": "application/json",
  };
};

/**
 * Create x402 V2 PaymentRequired headers
 * Matches x402 V2 spec format with x402Version: 2 and resource info
 */
export const createX402V2PaymentRequiredHeaders = (
  requirements: PaymentRequirementsV2,
  resourceUrl: string,
  options?: {
    description?: string;
    mimeType?: string;
    errorMessage?: string;
  }
): Record<string, string> => {
  const resource: ResourceInfo = {
    url: resourceUrl,
    description: options?.description ?? "API Access",
    mimeType: options?.mimeType ?? "application/json",
  };

  const paymentRequired: PaymentRequiredV2 = {
    x402Version: 2,
    ...(options?.errorMessage && { error: options.errorMessage }),
    resource,
    accepts: [requirements],
    ...(requirements.extra && { extensions: requirements.extra }),
  };
  return {
    [V2_HEADERS.PAYMENT_REQUIRED]: safeBase64Encode(JSON.stringify(paymentRequired)),
    "Content-Type": "application/json",
  };
};

/**
 * Create payment required headers
 * Legacy function - use createX402V1PaymentRequiredHeaders or createX402V2PaymentRequiredHeaders instead
 */
export const createPaymentRequiredHeaders = (
  requirements: PaymentRequirements,
  version: 1 | 2,
  resourceUrl?: string
): Record<string, string> => {
  const url = resourceUrl ?? "https://api.example.com";

  if (version === 1) {
    return createX402V1PaymentRequiredHeaders(
      requirements as X402PaymentRequirementsV1
    );
  }

  return createX402V2PaymentRequiredHeaders(
    requirements as PaymentRequirementsV2,
    url
  );
};

/**
 * Create settlement headers for x402 V1 or V2
 * Uses proper x402 format with version-specific encoding
 */
export const createSettlementHeaders = (
  response: SettlementResponseV1 | SettlementResponseV2,
  version: 1 | 2,
  network?: string,
  payer?: string
): Record<string, string> => {
  if (version === 1) {
    // x402 V1 settlement response format
    const txHash = "transaction" in response ? response.transaction : response.txHash || "";
    const isSuccess = "success" in response ? response.success : false;
    const networkName = network || "base-sepolia";

    const settlementV1: X402SettlementResponseV1 = {
      success: isSuccess,
      transaction: txHash,
      network: networkName,
      payer: (payer || "0x0000000000000000000000000000000000000000") as `0x${string}`,
    };
    return { [V1_HEADERS.PAYMENT_RESPONSE]: encodeX402SettlementResponseV1(settlementV1) };
  }

  // x402 V2 settlement response format
  const txHash = "transaction" in response ? response.transaction : "";
  const isSuccess = "success" in response ? response.success : false;

  const settlementV2: SettlementResponseV2 = {
    success: isSuccess,
    transaction: txHash,
    network: (network || "eip155:84532") as `eip155:${string}`,
    ...(payer && { payer: payer as `0x${string}` }),
  };
  return { [V2_HEADERS.PAYMENT_RESPONSE]: safeBase64Encode(JSON.stringify(settlementV2)) };
};

