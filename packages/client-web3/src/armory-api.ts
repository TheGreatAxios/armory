/**
 * Armory API - Simplified payment interface (Web3)
 * Provides a configurable object with method-based payment functions
 */

import type {
  NetworkId,
  TokenId,
  ArmoryPaymentResult,
} from "@armory-sh/base";
import type {
  SimpleWalletInput,
  NormalizedWallet,
} from "./payment-api";
import { normalizeWallet } from "./payment-api";
import type { Web3Account } from "./types";

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

export const createArmory = (config: ArmoryConfig): ArmoryInstance => {
  const internal = normalizeArmoryConfig(config);

  const makeRequest = async <T>(
    url: string,
    method: HttpMethod,
    body?: unknown
  ): Promise<ArmoryPaymentResult<T>> => {
    try {
      const headers = new Headers();
      const response = await fetch(url, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });

      if (!response.ok) {
        const error = await response.text();
        return {
          success: false,
          code: "PAYMENT_DECLINED",
          message: `Request failed: ${response.status} ${error}`,
        };
      }

      const data = await response.json() as T;

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
