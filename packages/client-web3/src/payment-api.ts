/**
 * Simple one-line payment API for Armory (Web3)
 * Focus on DX/UX - "everything just magically works"
 */

import type {
  ArmoryPaymentResult,
  NetworkId,
  TokenId,
  ValidationError,
} from "@armory-sh/base";
import {
  isValidationError,
  resolveNetwork,
  resolveToken,
  validatePaymentConfig,
} from "@armory-sh/base";
import { createX402Client } from "./client";
import type { Web3Account } from "./types";

// ═══════════════════════════════════════════════════════════════
// Simple Wallet Types
// ═══════════════════════════════════════════════════════════════

/**
 * Simple wallet input - accepts wallet directly or wrapped for backward compatibility
 */
export type SimpleWalletInput = Web3Account | { account: Web3Account };

/**
 * Normalized wallet (internal use)
 */
export type NormalizedWallet = Web3Account;

/**
 * Normalize wallet input to internal format
 */
export const normalizeWallet = (
  wallet: SimpleWalletInput,
): NormalizedWallet => {
  if (typeof wallet === "object" && wallet !== null && "account" in wallet) {
    return wallet.account as NormalizedWallet;
  }
  return wallet as NormalizedWallet;
};

// ═══════════════════════════════════════════════════════════════
// armoryPay - One-line payment function
// ═══════════════════════════════════════════════════════════════

/**
 * Make a payment-protected API request with one line of code
 */
export const armoryPay = async <T = unknown>(
  wallet: SimpleWalletInput,
  url: string,
  network: NetworkId,
  token: TokenId,
  options?: {
    /** Request method (default: GET) */
    method?: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
    /** Request body (for POST/PUT/PATCH) */
    body?: unknown;
    /** Request headers */
    headers?: Record<string, string>;
    /** Protocol version (V2 only) */
    version?: 2;
    /** Payment amount in token units (default: from 402 header) */
    amount?: string;
  },
): Promise<ArmoryPaymentResult<T>> => {
  try {
    const account = normalizeWallet(wallet);

    const config = validatePaymentConfig(network, token);
    if (isValidationError(config)) {
      return {
        success: false,
        code: config.code,
        message: config.message,
        details: config,
      };
    }

    const client = createX402Client({
      account,
      network: config.network.config.name,
      version: options?.version ?? 2,
      token: config.token.config,
    });

    const method = options?.method ?? "GET";
    const headers = new Headers(options?.headers ?? {});

    let response: Response;
    if (method === "GET") {
      response = await client.fetch(url, { method, headers });
    } else {
      response = await client.fetch(url, {
        method,
        headers,
        body: JSON.stringify(options?.body),
      });
    }

    if (response.status === 402) {
      return {
        success: false,
        code: "PAYMENT_REQUIRED",
        message: "Payment required but could not be completed automatically",
      };
    }

    if (!response.ok) {
      const error = await response.text();
      return {
        success: false,
        code: "PAYMENT_DECLINED",
        message: `Request failed: ${response.status} ${error}`,
      };
    }

    const data = (await response.json()) as T;

    const txHash = response.headers.get("PAYMENT-RESPONSE");

    return {
      success: true,
      data,
      ...(txHash && { txHash }),
    };
  } catch (error) {
    return {
      success: false,
      code: "NETWORK_ERROR",
      message:
        error instanceof Error ? error.message : "Unknown error occurred",
      details: error,
    };
  }
};

/**
 * Make a GET request with payment
 */
export const armoryGet = <T = unknown>(
  wallet: SimpleWalletInput,
  url: string,
  network: NetworkId,
  token: TokenId,
  options?: Omit<Parameters<typeof armoryPay>[4], "method">,
): Promise<ArmoryPaymentResult<T>> => {
  return armoryPay<T>(wallet, url, network, token, {
    ...options,
    method: "GET",
  });
};

/**
 * Make a POST request with payment
 */
export const armoryPost = <T = unknown>(
  wallet: SimpleWalletInput,
  url: string,
  network: NetworkId,
  token: TokenId,
  body?: unknown,
  options?: Omit<Parameters<typeof armoryPay>[4], "method" | "body">,
): Promise<ArmoryPaymentResult<T>> => {
  return armoryPay<T>(wallet, url, network, token, {
    ...options,
    method: "POST",
    body,
  });
};

/**
 * Make a PUT request with payment
 */
export const armoryPut = <T = unknown>(
  wallet: SimpleWalletInput,
  url: string,
  network: NetworkId,
  token: TokenId,
  body?: unknown,
  options?: Omit<Parameters<typeof armoryPay>[4], "method" | "body">,
): Promise<ArmoryPaymentResult<T>> => {
  return armoryPay<T>(wallet, url, network, token, {
    ...options,
    method: "PUT",
    body,
  });
};

/**
 * Make a DELETE request with payment
 */
export const armoryDelete = <T = unknown>(
  wallet: SimpleWalletInput,
  url: string,
  network: NetworkId,
  token: TokenId,
  options?: Omit<Parameters<typeof armoryPay>[4], "method">,
): Promise<ArmoryPaymentResult<T>> => {
  return armoryPay<T>(wallet, url, network, token, {
    ...options,
    method: "DELETE",
  });
};

/**
 * Make a PATCH request with payment
 */
export const armoryPatch = <T = unknown>(
  wallet: SimpleWalletInput,
  url: string,
  network: NetworkId,
  token: TokenId,
  body?: unknown,
  options?: Omit<Parameters<typeof armoryPay>[4], "method" | "body">,
): Promise<ArmoryPaymentResult<T>> => {
  return armoryPay<T>(wallet, url, network, token, {
    ...options,
    method: "PATCH",
    body,
  });
};

// ═══════════════════════════════════════════════════════════════
// Utility Functions
// ═══════════════════════════════════════════════════════════════

/**
 * Get the wallet address from a SimpleWalletInput
 */
export const getWalletAddress = (wallet: SimpleWalletInput): string => {
  const account = normalizeWallet(wallet);
  if ("address" in account) return account.address;
  if (Array.isArray(account) && account[0]) return account[0].address;
  throw new Error("Unable to get address from account");
};

/**
 * Validate a network identifier without making a request
 */
export const validateNetwork = (
  network: NetworkId,
): ValidationError | { success: true; network: string } => {
  const resolved = resolveNetwork(network);
  if (isValidationError(resolved)) {
    return resolved;
  }
  return { success: true, network: resolved.config.name };
};

/**
 * Validate a token identifier without making a request
 */
export const validateToken = (
  token: TokenId,
  network?: NetworkId,
): ValidationError | { success: true; token: string; network: string } => {
  let resolvedNetwork;
  if (network) {
    const networkResult = resolveNetwork(network);
    if (isValidationError(networkResult)) {
      return networkResult;
    }
    resolvedNetwork = networkResult;
  }
  const resolved = resolveToken(token, resolvedNetwork);
  if (isValidationError(resolved)) {
    return resolved;
  }
  return {
    success: true,
    token: resolved.config.symbol,
    network: resolved.network.config.name,
  };
};

/**
 * Get list of available networks
 */
export const getNetworks = (): string[] => {
  const { getAvailableNetworks } = require("@armory-sh/base");
  return getAvailableNetworks();
};

/**
 * Get list of available tokens
 */
export const getTokens = (): string[] => {
  const { getAvailableTokens } = require("@armory-sh/base");
  return getAvailableTokens();
};
