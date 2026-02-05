import type {
  PaymentRequirements,
  PaymentRequirementsV1,
  PaymentRequirementsV2,
  SettlementResponse,
  SettlementResponseV1,
  SettlementResponseV2,
  PayToV2,
} from "@armory/base";
import { getNetworkConfig, getNetworkByChainId } from "@armory/base";
import type {
  MiddlewareConfig,
  FacilitatorConfig,
  FacilitatorVerifyResult,
  FacilitatorSettleResult,
  HttpRequest,
} from "./types.js";

const getNetworkName = (network: string | number): string => {
  if (typeof network === "string") return network;
  const net = getNetworkByChainId(network);
  if (!net) throw new Error(`No network found for chainId: ${network}`);
  return net.name.toLowerCase().replace(" mainnet", "").replace(" sepolia", "-sepolia");
};

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
  expiry: number
): PaymentRequirementsV2 => {
  const networkName = getNetworkName(config.network);
  const network = getNetworkConfig(networkName);
  if (!network) throw new Error(`Unsupported network: ${networkName}`);

  return {
    amount: config.amount,
    to: config.payTo as PayToV2,
    chainId: network.caip2Id as `eip155:${string}`,
    assetId: network.caipAssetId as `eip155:${string}/erc20:${string}`,
    nonce: `${Date.now()}-${crypto.randomUUID()}`,
    expiry,
  };
};

export const createPaymentRequirements = (
  config: MiddlewareConfig,
  version: 1 | 2 = 1
): PaymentRequirements => {
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
    return { "X-PAYMENT-REQUIRED": encode(requirements as PaymentRequirementsV1) };
  }
  return { "PAYMENT-REQUIRED": encode(requirements as PaymentRequirementsV2) };
};

export const createSettlementHeaders = (
  response: SettlementResponse,
  version: 1 | 2
): Record<string, string> => {
  if (version === 1) {
    return { "X-PAYMENT-RESPONSE": encode(response as SettlementResponseV1) };
  }
  return { "PAYMENT-RESPONSE": encode(response as SettlementResponseV2) };
};
