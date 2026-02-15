/**
 * Simplified middleware API for easy x402 payment integration
 * Just specify payTo address and optional chains/tokens by name
 */

import type { Context, Next } from "hono";
import type {
  PaymentRequirementsV2,
  PaymentRequiredV2,
  ResourceInfo,
  CustomToken,
  Extensions,
} from "@armory-sh/base";
import {
  resolveNetwork,
  resolveToken,
  safeBase64Encode,
  V2_HEADERS,
  registerToken,
  createPaymentRequiredHeaders,
  createSettlementHeaders,
} from "@armory-sh/base";
import type { ResolvedNetwork, ResolvedToken, ValidationError } from "@armory-sh/base";
import {
  TOKENS,
} from "@armory-sh/base";
import type { ExtensionConfig } from "./extensions";
import { buildExtensions } from "./extensions";
import { decodePayload, verifyPaymentWithRetry, settlePaymentWithRetry } from "./payment-utils";

type NetworkId = string | number;
type TokenId = string;

export interface PaymentConfig {
  payTo: string;
  chains?: NetworkId[];
  chain?: NetworkId;
  tokens?: TokenId[];
  token?: TokenId;
  amount?: string;
  maxTimeoutSeconds?: number;

  payToByChain?: Record<NetworkId, string>;
  payToByToken?: Record<NetworkId, Record<TokenId, string>>;

  facilitatorUrl?: string;
  facilitatorUrlByChain?: Record<NetworkId, string>;
  facilitatorUrlByToken?: Record<NetworkId, Record<TokenId, string>>;

  extensions?: ExtensionConfig;
}

export interface ResolvedSimpleConfig {
  requirements: PaymentRequirementsV2[];
  error?: ValidationError;
}

const isValidationError = (value: unknown): value is ValidationError => {
  return typeof value === "object" && value !== null && "code" in value;
};

function ensureTokensRegistered() {
  for (const token of Object.values(TOKENS)) {
    try {
      registerToken(token);
    } catch {
    }
  }
}

function resolveChainTokenInputs(
  chains: NetworkId[] | undefined,
  tokens: TokenId[] | undefined
): { networks: ResolvedNetwork[]; tokens: ResolvedToken[]; error?: ValidationError } {
  const resolvedNetworks: ResolvedNetwork[] = [];
  const resolvedTokens: ResolvedToken[] = [];
  const errors: string[] = [];

  const networkInputs = chains?.length ? chains : Object.keys({
    ethereum: 1,
    base: 8453,
    "base-sepolia": 84532,
    "skale-base": 1187947933,
    "skale-base-sepolia": 324705682,
    "ethereum-sepolia": 11155111,
  });

  for (const networkId of networkInputs) {
    const resolved = resolveNetwork(networkId);
    if (isValidationError(resolved)) {
      errors.push(`Network "${networkId}": ${resolved.message}`);
    } else {
      resolvedNetworks.push(resolved);
    }
  }

  const tokenInputs = tokens?.length ? tokens : ["usdc"];

  for (const tokenId of tokenInputs) {
    let found = false;
    for (const network of resolvedNetworks) {
      const resolved = resolveToken(tokenId, network);
      if (isValidationError(resolved)) {
        continue;
      }
      resolvedTokens.push(resolved);
      found = true;
      break;
    }
    if (!found) {
      errors.push(`Token "${tokenId}" not found on any specified network`);
    }
  }

  if (errors.length > 0) {
    return {
      networks: resolvedNetworks,
      tokens: resolvedTokens,
      error: {
        code: "VALIDATION_FAILED",
        message: errors.join("; "),
      },
    };
  }

  return { networks: resolvedNetworks, tokens: resolvedTokens };
}

function toAtomicUnits(amount: string): string {
  if (amount.includes(".")) {
    const [whole, fractional = ""] = amount.split(".");
    const paddedFractional = fractional.padEnd(6, "0").slice(0, 6);
    return `${whole}${paddedFractional}`.replace(/^0+/, "") || "0";
  }
  return `${amount}000000`;
}

function resolvePayTo(
  config: PaymentConfig,
  network: ResolvedNetwork,
  token: ResolvedToken
): string {
  const chainId = network.config.chainId;

  if (config.payToByToken) {
    for (const [chainKey, tokenMap] of Object.entries(config.payToByToken)) {
      const resolvedChain = resolveNetwork(chainKey);
      if (!isValidationError(resolvedChain) && resolvedChain.config.chainId === chainId) {
        for (const [tokenKey, address] of Object.entries(tokenMap)) {
          const resolvedToken = resolveToken(tokenKey, network);
          if (!isValidationError(resolvedToken) && resolvedToken.config.contractAddress.toLowerCase() === token.config.contractAddress.toLowerCase()) {
            return address;
          }
        }
      }
    }
  }

  if (config.payToByChain) {
    for (const [chainKey, address] of Object.entries(config.payToByChain)) {
      const resolvedChain = resolveNetwork(chainKey);
      if (!isValidationError(resolvedChain) && resolvedChain.config.chainId === chainId) {
        return address;
      }
    }
  }

  return config.payTo;
}

function resolveFacilitatorUrl(
  config: PaymentConfig,
  network: ResolvedNetwork,
  token: ResolvedToken
): string | undefined {
  const chainId = network.config.chainId;

  if (config.facilitatorUrlByToken) {
    for (const [chainKey, tokenMap] of Object.entries(config.facilitatorUrlByToken)) {
      const resolvedChain = resolveNetwork(chainKey);
      if (!isValidationError(resolvedChain) && resolvedChain.config.chainId === chainId) {
        for (const [tokenKey, url] of Object.entries(tokenMap)) {
          const resolvedToken = resolveToken(tokenKey, network);
          if (!isValidationError(resolvedToken) && resolvedToken.config.contractAddress.toLowerCase() === token.config.contractAddress.toLowerCase()) {
            return url;
          }
        }
      }
    }
  }

  if (config.facilitatorUrlByChain) {
    for (const [chainKey, url] of Object.entries(config.facilitatorUrlByChain)) {
      const resolvedChain = resolveNetwork(chainKey);
      if (!isValidationError(resolvedChain) && resolvedChain.config.chainId === chainId) {
        return url;
      }
    }
  }

  return config.facilitatorUrl;
}

export function createPaymentRequirements(
  config: PaymentConfig
): ResolvedSimpleConfig {
  ensureTokensRegistered();

  const {
    payTo,
    chains,
    chain,
    tokens,
    token,
    amount = "1.0",
    maxTimeoutSeconds = 300,
  } = config;

  const chainInputs = chain ? [chain] : chains;
  const tokenInputs = token ? [token] : tokens;

  const { networks, tokens: resolvedTokens, error } = resolveChainTokenInputs(
    chainInputs,
    tokenInputs
  );

  if (error) {
    return { requirements: [], error };
  }

  const requirements: PaymentRequirementsV2[] = [];

  for (const network of networks) {
    for (const resolvedToken of resolvedTokens) {
      if (resolvedToken.network.config.chainId !== network.config.chainId) {
        continue;
      }

      const atomicAmount = toAtomicUnits(amount);
      const tokenConfig = resolvedToken.config;

      const resolvedPayTo = resolvePayTo(config, network, resolvedToken);
      const resolvedFacilitatorUrl = resolveFacilitatorUrl(config, network, resolvedToken);

      requirements.push({
        scheme: "exact",
        network: network.caip2,
        amount: atomicAmount,
        asset: tokenConfig.contractAddress,
        payTo: resolvedPayTo as `0x${string}`,
        maxTimeoutSeconds,
        extra: {
          name: tokenConfig.name,
          version: tokenConfig.version,
          ...(resolvedFacilitatorUrl && { facilitatorUrl: resolvedFacilitatorUrl }),
        },
      });
    }
  }

  return { requirements };
}

export function paymentMiddleware(config: PaymentConfig) {
  const { requirements, error } = createPaymentRequirements(config);

  return async (c: Context, next: Next): Promise<Response | void> => {
    if (error) {
      c.status(500);
      return c.json({
        error: "Payment middleware configuration error",
        details: error.message,
      });
    }

    const paymentHeader = c.req.header(V2_HEADERS.PAYMENT_SIGNATURE);

    if (!paymentHeader) {
      const resource: ResourceInfo = {
        url: c.req.url,
        description: "API Access",
        mimeType: "application/json",
      };

      const paymentRequired: PaymentRequiredV2 = {
        x402Version: 2,
        error: "Payment required",
        resource,
        accepts: requirements,
        extensions: config.extensions ? buildExtensions(config.extensions) : undefined,
      };

      c.status(402);
      c.header(V2_HEADERS.PAYMENT_REQUIRED, safeBase64Encode(JSON.stringify(paymentRequired)));
      return c.json({
        error: "Payment required",
        accepts: requirements,
      });
    }

    let parsedPayload: unknown;
    try {
      ({ payload: parsedPayload } = decodePayload(paymentHeader));
    } catch {
      c.status(400);
      return c.json({ error: "Invalid payment payload" });
    }

    const primaryRequirement = requirements[0];
    if (!primaryRequirement) {
      c.status(500);
      return c.json({ error: "Payment middleware configuration error", details: "No payment requirements configured" });
    }

    const requirementFacilitatorUrl = primaryRequirement.extra?.facilitatorUrl;
    const facilitatorUrl = config.facilitatorUrl
      ?? (typeof requirementFacilitatorUrl === "string" ? requirementFacilitatorUrl : undefined);
    const verifyResult = await verifyPaymentWithRetry(parsedPayload as never, primaryRequirement, facilitatorUrl);
    if (!verifyResult.success) {
      c.status(402);
      c.header(V2_HEADERS.PAYMENT_REQUIRED, createPaymentRequiredHeaders(requirements)[V2_HEADERS.PAYMENT_REQUIRED]);
      return c.json({ error: "Payment verification failed", message: verifyResult.error });
    }

    c.set("payment", {
      payload: parsedPayload,
      payerAddress: verifyResult.payerAddress,
      verified: true,
    });

    await next();

    if (c.res.status >= 400) {
      return;
    }

    const settleResult = await settlePaymentWithRetry(parsedPayload as never, primaryRequirement, facilitatorUrl);
    if (!settleResult.success) {
      c.status(502);
      c.res = c.json({ error: "Settlement failed", details: settleResult.error }, 502);
      return;
    }

    const headers = createSettlementHeaders(settleResult);
    for (const [key, value] of Object.entries(headers)) {
      c.header(key, value);
    }
  };
}
