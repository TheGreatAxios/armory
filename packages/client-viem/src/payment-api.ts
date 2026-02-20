/**
 * Simple one-line payment API for Armory
 * Focus on DX/UX - "everything just magically works"
 */

import type {
  ArmoryPaymentResult,
  NetworkId,
  ResolvedNetwork,
  TokenId,
  ValidationError,
} from "@armory-sh/base";
import {
  getAvailableNetworks,
  getAvailableTokens,
  isValidationError,
  registerToken,
  resolveNetwork,
  resolveToken,
  TOKENS,
  validatePaymentConfig,
} from "@armory-sh/base";
import type { Account, Address, WalletClient } from "viem";
import { createX402Client } from "./client";
import type { X402Wallet } from "./types";

// ═══════════════════════════════════════════════════════════════
// Simple Wallet Types
// ═══════════════════════════════════════════════════════════════

/**
 * Simple wallet input - accepts wallet directly or wrapped for backward compatibility
 */
export type SimpleWalletInput =
  | Account
  | WalletClient
  | { account: Account }
  | { walletClient: WalletClient };

/**
 * Normalized wallet (internal use)
 */
export type NormalizedWallet =
  | { type: "account"; account: Account }
  | { type: "walletClient"; walletClient: WalletClient };

/**
 * Normalize wallet input to internal format
 */
export const normalizeWallet = (
  wallet: SimpleWalletInput,
): NormalizedWallet => {
  if (typeof wallet === "object" && wallet !== null) {
    if ("account" in wallet && "type" in wallet) {
      return wallet as NormalizedWallet;
    }
    if ("account" in wallet) {
      return { type: "account", account: wallet.account };
    }
    if ("walletClient" in wallet) {
      return { type: "walletClient", walletClient: wallet.walletClient };
    }
  }
  if ("address" in wallet && "type" in wallet) {
    return { type: "account", account: wallet as Account };
  }
  if ("account" in wallet) {
    return { type: "walletClient", walletClient: wallet as WalletClient };
  }
  throw new Error("Invalid wallet input");
};

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
    /** Enable debug logging */
    debug?: boolean;
  },
): Promise<ArmoryPaymentResult<T>> => {
  try {
    // Ensure all standard tokens are registered before validation
    Object.values(TOKENS).forEach((token) => {
      try {
        registerToken(token);
      } catch {
        // Token already registered, ignore
      }
    });

    const normalized = normalizeWallet(wallet);
    const x402Wallet: X402Wallet =
      normalized.type === "account"
        ? { type: "account", account: normalized.account }
        : { type: "walletClient", walletClient: normalized.walletClient };

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
      wallet: x402Wallet,
      version: options?.version ?? 2,
      token: config.token.config,
      debug: options?.debug ?? false,
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

    const data = await response.json();

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
export const getWalletAddress = (wallet: SimpleWalletInput): Address => {
  const normalized = normalizeWallet(wallet);
  return normalized.type === "account"
    ? normalized.account.address
    : normalized.walletClient.account.address;
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
  let resolvedNetwork: ResolvedNetwork | undefined;
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
