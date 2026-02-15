/**
 * Armory API - Simplified payment interface
 * Provides a configurable object with method-based payment functions
 */

import type { Account, WalletClient, Address } from "viem";
import type {
  NetworkId,
  TokenId,
  ArmoryPaymentResult,
  PaymentRequirementsV2,
} from "@armory-sh/base";
import type {
  SimpleWalletInput,
  NormalizedWallet,
} from "./payment-api";
import { normalizeWallet } from "./payment-api";
import {
  resolveNetwork,
  resolveToken,
  validatePaymentConfig,
  isValidationError,
  createError,
  getNetworkByChainId,
} from "@armory-sh/base";
import { createX402Client } from "./client";

// ═══════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════

export type HttpMethod = "GET" | "POST" | "PUT" | "DELETE" | "PATCH";

const ALL_METHODS: Set<HttpMethod> = new Set(["GET", "POST", "PUT", "DELETE", "PATCH"]);

export interface ArmoryConfig {
  wallet: SimpleWalletInput;
  methods?: HttpMethod[] | HttpMethod;
  tokens?: TokenId[] | TokenId;
  chains?: NetworkId[] | NetworkId;
  debug?: boolean;
}

interface ArmoryInternalConfig {
  wallet: NormalizedWallet;
  allowedMethods: Set<HttpMethod>;
  allowedTokens: TokenId[];
  allowedChains: NetworkId[];
  debug: boolean;
}

export interface PaymentOptions {
  method?: HttpMethod;
  body?: unknown;
}

export interface ArmoryInstance {
  get<T>(url: string, body?: unknown): Promise<ArmoryPaymentResult<T>>;
  post<T>(url: string, body?: unknown): Promise<ArmoryPaymentResult<T>>;
  put<T>(url: string, body?: unknown): Promise<ArmoryPaymentResult<T>>;
  delete<T>(url: string): Promise<ArmoryPaymentResult<T>>;
  patch<T>(url: string, body?: unknown): Promise<ArmoryPaymentResult<T>>;
  pay<T>(url: string, options?: PaymentOptions): Promise<ArmoryPaymentResult<T>>;
  call<T>(url: string): Promise<ArmoryPaymentResult<T>>;
}

// ═══════════════════════════════════════════════════════════════
// Utility Functions
// ═══════════════════════════════════════════════════════════════

const arrayify = <T>(value: T | T[] | undefined): T[] | undefined => {
  if (value === undefined) return undefined;
  return Array.isArray(value) ? value : [value];
};

const normalizeArmoryConfig = (config: ArmoryConfig): ArmoryInternalConfig => ({
  wallet: normalizeWallet(config.wallet),
  allowedMethods: config.methods
    ? new Set(arrayify(config.methods) as HttpMethod[])
    : ALL_METHODS,
  allowedTokens: arrayify(config.tokens) ?? [],
  allowedChains: arrayify(config.chains) ?? [],
  debug: config.debug ?? false,
});

const toCaip2Id = (chainId: number): `eip155:${string}` =>
  `eip155:${chainId}`;

const scorePaymentOption = (
  option: PaymentRequirementsV2,
  allowedTokens: TokenId[],
  allowedChains: NetworkId[]
): number => {
  let score = 0;

  const chainId = parseInt(option.network.split(":")[1], 10);
  const tokenAddress = option.asset.toLowerCase();

  for (const chain of allowedChains) {
    const resolved = resolveNetwork(chain);
    if (!("code" in resolved) && resolved.config.chainId === chainId) {
      score += 10;
      break;
    }
  }

  for (const token of allowedTokens) {
    const resolved = resolveToken(token);
    if (!("code" in resolved) && resolved.config.contractAddress.toLowerCase() === tokenAddress) {
      score += 5;
      break;
    }
  }

  if (chainId === 8453) score += 2;

  if (tokenAddress === "0x833589fcd6edb6e08f4c7c32d4f71b54bdA02913") {
    score += 1;
  }

  const amount = parseInt(option.amount, 10);
  if (amount < 1000000) score += 1;

  return score;
};

const selectPaymentOption = (
  accepts: PaymentRequirementsV2[],
  allowedTokens: TokenId[],
  allowedChains: NetworkId[],
  allowedMethods: Set<HttpMethod>
): PaymentRequirementsV2 | null => {
  const validOptions = accepts.filter((option) => {
    const chainId = parseInt(option.network.split(":")[1], 10);

    for (const chain of allowedChains) {
      const resolved = resolveNetwork(chain);
      if (!("code" in resolved) && resolved.config.chainId === chainId) {
        for (const token of allowedTokens) {
          const resolvedToken = resolveToken(token, resolved);
          if (!("code" in resolvedToken) && resolvedToken.config.contractAddress.toLowerCase() === option.asset.toLowerCase()) {
            return true;
          }
        }
      }
    }

    if (allowedChains.length === 0 && allowedTokens.length === 0) {
      return true;
    }

    return false;
  });

  if (validOptions.length === 0) return null;

  if (validOptions.length === 1) return validOptions[0];

  return validOptions.sort((a, b) =>
    scorePaymentOption(b, allowedTokens, allowedChains) -
    scorePaymentOption(a, allowedTokens, allowedChains)
  )[0];
};

// ═══════════════════════════════════════════════════════════════
// createArmory Factory
// ═══════════════════════════════════════════════════════════════

export const createArmory = (config: ArmoryConfig): ArmoryInstance => {
  const internal = normalizeArmoryConfig(config);

  const x402Wallet = internal.wallet.type === "account"
    ? { type: "account" as const, account: internal.wallet.account }
    : { type: "walletClient" as const, walletClient: internal.wallet.walletClient };

  const makeRequest = async <T>(
    url: string,
    method: HttpMethod,
    body?: unknown
  ): Promise<ArmoryPaymentResult<T>> => {
    try {
      const headers = new Headers();

      let response = await fetch(url, { method, headers });

      if (response.status === 402) {
        const paymentRequiredHeader = response.headers.get("PAYMENT-REQUIRED");
        if (!paymentRequiredHeader) {
          return {
            success: false,
            code: "PAYMENT_REQUIRED",
            message: "Payment required but no PAYMENT-REQUIRED header found",
          };
        }

        const decoded = Buffer.from(paymentRequiredHeader, "base64").toString("utf-8");
        const paymentRequired = JSON.parse(decoded) as { x402Version: number; accepts: PaymentRequirementsV2[] };

        if (paymentRequired.x402Version !== 2 || !paymentRequired.accepts) {
          return {
            success: false,
            code: "PAYMENT_REQUIRED",
            message: "Invalid payment required format",
          };
        }

        const selectedOption = selectPaymentOption(
          paymentRequired.accepts,
          internal.allowedTokens,
          internal.allowedChains,
          internal.allowedMethods
        );

        if (!selectedOption) {
          return {
            success: false,
            code: "PAYMENT_REQUIRED",
            message: "No compatible payment option found",
          };
        }

        const chainId = parseInt(selectedOption.network.split(":")[1], 10);
        const networkConfig = getNetworkByChainId(chainId) ?? {
          chainId,
          name: "Unknown",
          rpcUrl: "",
          usdcAddress: selectedOption.asset,
          caip2Id: selectedOption.network,
          caipAssetId: `${selectedOption.network}/erc20:${selectedOption.asset}` as `eip155:${number}/erc20:${string}`,
        };

        const client = createX402Client({
          wallet: x402Wallet,
          version: 2,
          token: {
            symbol: "CUSTOM",
            name: "Payment Token",
            version: "1",
            chainId,
            contractAddress: selectedOption.asset,
            decimals: 6,
          },
          debug: internal.debug,
        });

        const fromAddress = internal.wallet.type === "account"
          ? internal.wallet.account.address
          : internal.wallet.walletClient.account.address;

        const nonce = `0x${Date.now().toString(16).padStart(64, "0")}` as `0x${string}`;
        const validBefore = Math.floor(Date.now() / 1000) + 3600;

        const payment = await client.createPayment(
          selectedOption.amount,
          selectedOption.payTo as Address,
          selectedOption.asset,
          chainId,
          validBefore
        );

        const signatureHeader = Buffer.from(JSON.stringify(payment)).toString("base64");
        headers.set("PAYMENT-SIGNATURE", signatureHeader);

        response = await fetch(url, {
          method,
          headers,
          body: body !== undefined ? JSON.stringify(body) : undefined,
        });

        if (internal.debug) {
          console.log("[Armory] Payment completed, status:", response.status);
        }
      } else {
        response = await fetch(url, {
          method,
          headers,
          body: body !== undefined ? JSON.stringify(body) : undefined,
        });
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

  return {
    get: <T>(url: string, body?: unknown) => makeRequest<T>(url, "GET", body),
    post: <T>(url: string, body?: unknown) => makeRequest<T>(url, "POST", body),
    put: <T>(url: string, body?: unknown) => makeRequest<T>(url, "PUT", body),
    delete: <T>(url: string) => makeRequest<T>(url, "DELETE"),
    patch: <T>(url: string, body?: unknown) => makeRequest<T>(url, "PATCH", body),
    pay: <T>(url: string, options?: PaymentOptions) =>
      makeRequest<T>(url, options?.method ?? "GET", options?.body),
    call: <T>(url: string) => makeRequest<T>(url, "GET"),
  };
};
