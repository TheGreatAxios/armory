/**
 * Armory API - Simplified payment interface (Ethers)
 * Provides a configurable object with method-based payment functions
 */

import type { Signer } from "ethers";
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
  isValidationError,
  getNetworkByChainId,
} from "@armory-sh/base";
import { createX402Transport } from "./transport";

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

  const amount = parseInt(option.maxAmountRequired, 10);
  if (amount < 1000000) score += 1;

  return score;
};

const selectPaymentOption = (
  accepts: PaymentRequirementsV2[],
  allowedTokens: TokenId[],
  allowedChains: NetworkId[],
  _allowedMethods: Set<HttpMethod>
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

  const transport = createX402Transport();
  transport.setSigner(internal.wallet);

  const makeRequest = async <T>(
    url: string,
    method: HttpMethod,
    body?: unknown
  ): Promise<ArmoryPaymentResult<T>> => {
    try {
      let response: Response;
      const headers = {};

      if (method === "GET") {
        response = await transport.get(url, { headers });
      } else if (method === "POST") {
        response = await transport.post(url, body, { headers });
      } else if (method === "PUT") {
        response = await transport.put(url, body, { headers });
      } else if (method === "DELETE") {
        response = await transport.del(url, { headers });
      } else if (method === "PATCH") {
        response = await transport.patch(url, body, { headers });
      } else {
        response = await transport.fetch(url, { method, headers });
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
