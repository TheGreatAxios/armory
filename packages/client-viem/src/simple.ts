/**
 * Simple one-line payment API for Armory
 * Focus on DX/UX - "everything just magically works"
 */

import type {
  Account,
  WalletClient,
  Address,
} from "viem";
import type {
  NetworkId,
  TokenId,
  ArmoryPaymentResult,
  PaymentResult,
  PaymentError,
  ValidationError,
  ResolvedNetwork,
} from "@armory-sh/base";
import type { X402Wallet } from "./types";
import {
  resolveNetwork,
  resolveToken,
  validatePaymentConfig,
  isValidationError,
  createError,
  getAvailableNetworks,
  getAvailableTokens,
} from "@armory-sh/base";
import { createX402Client } from "./client";

// ═══════════════════════════════════════════════════════════════
// Simple Wallet Types
// ═══════════════════════════════════════════════════════════════

/**
 * Simple wallet configuration
 * Pass a viem Account or WalletClient directly
 */
export type SimpleWallet =
  | { account: Account }
  | { walletClient: WalletClient };

// ═══════════════════════════════════════════════════════════════
// armoryPay - One-line payment function
// ═══════════════════════════════════════════════════════════════

/**
 * Make a payment-protected API request with one line of code
 *
 * @example
 * ```ts
 * const result = await armoryPay(
 *   { account },                    // wallet
 *   "https://api.example.com/data", // URL
 *   "base",                         // network
 *   "usdc"                          // token
 * );
 *
 * if (result.success) {
 *   console.log(result.data);
 * } else {
 *   console.error(result.message);
 * }
 * ```
 */
export const armoryPay = async <T = unknown>(
  wallet: SimpleWallet,
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
    /** Protocol version (default: auto-detect) */
    version?: 1 | 2 | "auto";
    /** Payment amount in token units (default: from 402 header) */
    amount?: string;
    /** Enable debug logging */
    debug?: boolean;
  }
): Promise<ArmoryPaymentResult<T>> => {
  try {
    // Convert to X402Wallet
    const x402Wallet: X402Wallet = "account" in wallet
      ? { type: "account", account: wallet.account }
      : { type: "walletClient", walletClient: wallet.walletClient };

    // Validate network and token combination
    const config = validatePaymentConfig(network, token);
    if (isValidationError(config)) {
      return {
        success: false,
        code: config.code as any,
        message: config.message,
        details: config,
      };
    }

    // Create client
    const client = createX402Client({
      wallet: x402Wallet,
      version: options?.version ?? "auto",
      token: config.token.config,
      debug: options?.debug ?? false,
    });

    // Make request
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

    // Check if payment was required and handled
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

    const data = await response.json();

    // Check for settlement header
    const txHash = response.headers.get("X-PAYMENT-RESPONSE") ||
                   response.headers.get("PAYMENT-RESPONSE");

    return {
      success: true,
      data,
      ...(txHash && { txHash }),
    };

  } catch (error) {
    return {
      success: false,
      code: "NETWORK_ERROR",
      message: error instanceof Error ? error.message : "Unknown error occurred",
      details: error,
    };
  }
};

/**
 * Make a GET request with payment
 */
export const armoryGet = <T = unknown>(
  wallet: SimpleWallet,
  url: string,
  network: NetworkId,
  token: TokenId,
  options?: Omit<Parameters<typeof armoryPay>[4], "method">
): Promise<ArmoryPaymentResult<T>> => {
  return armoryPay<T>(wallet, url, network, token, { ...options, method: "GET" });
};

/**
 * Make a POST request with payment
 */
export const armoryPost = <T = unknown>(
  wallet: SimpleWallet,
  url: string,
  network: NetworkId,
  token: TokenId,
  body?: unknown,
  options?: Omit<Parameters<typeof armoryPay>[4], "method" | "body">
): Promise<ArmoryPaymentResult<T>> => {
  return armoryPay<T>(wallet, url, network, token, { ...options, method: "POST", body });
};

// ═══════════════════════════════════════════════════════════════
// Utility Functions
// ═══════════════════════════════════════════════════════════════

/**
 * Get the wallet address from a SimpleWallet
 */
export const getWalletAddress = (wallet: SimpleWallet): Address => {
  return "account" in wallet
    ? wallet.account.address
    : wallet.walletClient.account.address;
};

/**
 * Validate a network identifier without making a request
 */
export const validateNetwork = (network: NetworkId): ValidationError | { success: true; network: string } => {
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
  network?: NetworkId
): ValidationError | { success: true; token: string; network: string } => {
  let resolvedNetwork: ResolvedNetwork | undefined = undefined;
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
  return getAvailableNetworks();
};

/**
 * Get list of available tokens
 */
export const getTokens = (): string[] => {
  return getAvailableTokens();
};
