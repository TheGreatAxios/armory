import type {
  PaymentRequirements,
  PaymentRequirementsV1,
  PaymentRequirementsV2,
  PaymentPayloadV1,
  SettlementResponseV1,
  SettlementResponseV2,
  PayToV2,
  X402SettlementResponse,
  X402PaymentRequiredV1,
  X402PaymentRequirementsV1,
} from "@armory-sh/base";
import {
  getNetworkConfig,
  getNetworkByChainId,
  encodeSettlementResponse,
  encodeX402PaymentRequiredV1,
  normalizeNetworkName,
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
  expiry: number
): PaymentRequirementsV1 => {
  const networkName = getNetworkName(config.network);
  const network = getNetworkConfig(networkName);
  if (!network) throw new Error(`Unsupported network: ${networkName}`);

  return {
    amount: config.amount,
    network: networkName,
    contractAddress: network.usdcAddress,
    payTo: config.payTo as string,
    expiry,
  };
};

const createV2Requirements = (
  config: MiddlewareConfig,
  _expiry: number
): PaymentRequirementsV2 => {
  const networkName = getNetworkName(config.network);
  const network = getNetworkConfig(networkName);
  if (!network) throw new Error(`Unsupported network: ${networkName}`);

  // Extract address from payTo - should be a valid Ethereum address
  const payToAddress = typeof config.payTo === "string" && config.payTo.startsWith("0x")
    ? config.payTo as `0x${string}`
    : network.usdcAddress as `0x${string}`;

  return {
    scheme: "exact",
    network: getChainId(config.network) as `eip155:${string}`,
    amount: config.amount,
    asset: network.usdcAddress as `0x${string}`,
    payTo: payToAddress,
    maxTimeoutSeconds: 300,
  };
};

export const createPaymentRequirements = (
  config: MiddlewareConfig,
  version: 1 | 2 = 1
): PaymentRequirements => {
  const networkName = getNetworkName(config.network);
  const network = getNetworkConfig(networkName);
  if (!network) throw new Error(`Unsupported network: ${networkName}`);
  const expiry = Math.floor(Date.now() / 1000) + 3600;

  return version === 1 ? createV1Requirements(config, expiry) : createV2Requirements(config, expiry);
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

const encode = (data: unknown): string => btoa(JSON.stringify(data));

export const createPaymentRequiredHeaders = (
  requirements: PaymentRequirements,
  version: 1 | 2
): Record<string, string> => {
  if (version === 1) {
    // For V1, wrap in X402PaymentRequiredV1 format and encode
    const v1Requirements: X402PaymentRequiredV1 = {
      x402Version: 1,
      error: "Payment required",
      accepts: [requirements as unknown as X402PaymentRequirementsV1],
    };
    return { "X-PAYMENT-REQUIRED": encodeX402PaymentRequiredV1(v1Requirements) };
  }
  // For V2/x402 - base64 encode the JSON
  return { "PAYMENT-REQUIRED": Buffer.from(JSON.stringify(requirements)).toString("base64") };
};

/**
 * Accepts both X402SettlementResponse and legacy SettlementResponseV1/V2
 * For V1, manually constructs the header. For V2/x402, uses the x402 encoder.
 */
export const createSettlementHeaders = (
  response: X402SettlementResponse | SettlementResponseV1 | SettlementResponseV2,
  version: 1 | 2
): Record<string, string> => {
  // Extract success and txHash from any response format
  const isSuccess = "success" in response ? response.success : false;
  const txHash = "transaction" in response 
    ? response.transaction 
    : "txHash" in response 
      ? response.txHash 
      : "";

  if (version === 1) {
    // V1 settlement response
    const settlementJson = JSON.stringify({
      success: isSuccess,
      transaction: txHash,
    });
    return { "X-PAYMENT-RESPONSE": Buffer.from(settlementJson).toString("base64") };
  }
  
  // V2/x402 settlement response
  const settlementJson = JSON.stringify({
    success: isSuccess,
    transaction: txHash,
  });
  return { "PAYMENT-RESPONSE": Buffer.from(settlementJson).toString("base64") };
};
