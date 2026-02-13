/**
 * X402 Middleware Core - Coinbase Compatible
 * 
 * Core functions for X402 middleware using unified headers.
 */

import type {
  X402PaymentRequirements,
  X402SettlementResponse,
  X402Response,
} from "@armory-sh/base";
import {
  X402_HEADERS,
  safeBase64Encode,
  safeBase64Decode,
  X402_VERSION,
  toAtomicUnits,
} from "@armory-sh/base";
import { getNetworkConfig, NETWORKS } from "@armory-sh/base";
import type {
  X402MiddlewareConfig,
  FacilitatorConfig,
  FacilitatorVerifyResult,
  FacilitatorSettleResult,
  HttpRequest,
} from "./types.js";

// Network name to chain ID mapping
const NETWORK_TO_CHAIN_ID: Record<string, number> = {
  "base": 8453,
  "base-sepolia": 84532,
  "ethereum": 1,
  "ethereum-sepolia": 11155111,
  "polygon": 137,
  "polygon-amoy": 80002,
  "arbitrum": 42161,
  "arbitrum-sepolia": 421614,
  "optimism": 10,
  "optimism-sepolia": 11155420,
};

function getNetworkName(network: string | number): string {
  if (typeof network === "string") return network;
  
  for (const [name, id] of Object.entries(NETWORK_TO_CHAIN_ID)) {
    if (id === network) return name;
  }
  
  return `eip155:${network}`;
}

function getChainId(network: string): number {
  const chainId = NETWORK_TO_CHAIN_ID[network];
  if (chainId) return chainId;
  
  const match = network.match(/^eip155:(\d+)$/);
  if (match) return parseInt(match[1], 10);
  
  return 0;
}

export function createX402PaymentRequirements(
  config: X402MiddlewareConfig
): X402PaymentRequirements {
  const networkName = getNetworkName(config.network);
  const network = getNetworkConfig(networkName);
  
  if (!network) {
    throw new Error(`Unsupported network: ${networkName}`);
  }

  const maxTimeoutSeconds = config.maxTimeoutSeconds ?? 60;
  const atomicAmount = toAtomicUnits(config.amount);

  return {
    scheme: "exact",
    network: networkName,
    maxAmountRequired: atomicAmount,
    resource: config.resource ?? "",
    description: config.description ?? "",
    mimeType: config.mimeType ?? "application/json",
    outputSchema: config.outputSchema,
    payTo: config.payTo,
    maxTimeoutSeconds,
    asset: network.usdcAddress,
    extra: {
      name: config.domainName ?? "USD Coin",
      version: config.domainVersion ?? "2",
    },
  };
}

function findHeaderValue(
  headers: Record<string, string | string[] | undefined>,
  name: string
): string | undefined {
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
}

export function extractX402PaymentPayload(
  request: HttpRequest
): Record<string, unknown> | null {
  const encoded = findHeaderValue(request.headers, X402_HEADERS.PAYMENT);
  if (!encoded) return null;

  try {
    const decoded = safeBase64Decode(encoded);
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

async function postFacilitator(
  url: string,
  headers: Record<string, string>,
  body: unknown
): Promise<unknown> {
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
}

export async function verifyX402WithFacilitator(
  request: HttpRequest,
  facilitator: FacilitatorConfig
): Promise<FacilitatorVerifyResult> {
  const payload = extractX402PaymentPayload(request);
  if (!payload) {
    return { success: false, error: "No X-PAYMENT header found" };
  }

  try {
    const url = new URL("/verify", facilitator.url);
    const headers = facilitator.createHeaders?.() ?? {};
    const data = await postFacilitator(url.toString(), headers, {
      payload,
      headers: request.headers,
    });

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
}

export async function settleX402WithFacilitator(
  request: HttpRequest,
  facilitator: FacilitatorConfig
): Promise<FacilitatorSettleResult> {
  const payload = extractX402PaymentPayload(request);
  if (!payload) {
    return { success: false, error: "No X-PAYMENT header found" };
  }

  try {
    const url = new URL("/settle", facilitator.url);
    const headers = facilitator.createHeaders?.() ?? {};
    const data = await postFacilitator(url.toString(), headers, {
      payload,
      headers: request.headers,
    });

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
}

export function createX402PaymentRequiredHeaders(
  requirements: X402PaymentRequirements
): Record<string, string> {
  const response: X402Response = {
    x402Version: X402_VERSION,
    accepts: [requirements],
  };

  return {
    [X402_HEADERS.PAYMENT_REQUIRED]: safeBase64Encode(JSON.stringify(response)),
  };
}

export function createX402ErrorResponse(
  error: string,
  requirements?: X402PaymentRequirements
): Record<string, string> {
  const response: X402Response = {
    x402Version: X402_VERSION,
    error,
  };

  if (requirements) {
    response.accepts = [requirements];
  }

  return {
    [X402_HEADERS.PAYMENT_REQUIRED]: safeBase64Encode(JSON.stringify(response)),
  };
}

export function createX402SettlementHeaders(
  response: X402SettlementResponse
): Record<string, string> {
  return {
    [X402_HEADERS.PAYMENT_RESPONSE]: safeBase64Encode(JSON.stringify(response)),
  };
}

// Re-export types
export type { X402PaymentRequirements, X402SettlementResponse };
