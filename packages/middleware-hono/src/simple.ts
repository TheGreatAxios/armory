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
} from "@armory-sh/base";
import {
  resolveNetwork,
  resolveToken,
  safeBase64Encode,
  V2_HEADERS,
  registerToken,
} from "@armory-sh/base";
import type { ResolvedNetwork, ResolvedToken, ValidationError } from "@armory-sh/base";
import {
  TOKENS,
} from "@armory-sh/base";

type NetworkId = string | number;
type TokenId = string;

export interface SimplePaymentConfig {
  payTo: string;
  chains?: NetworkId[];
  chain?: NetworkId;
  tokens?: TokenId[];
  token?: TokenId;
  amount?: string;
  maxTimeoutSeconds?: number;
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

export function createSimpleRequirements(
  config: SimplePaymentConfig
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

      requirements.push({
        scheme: "exact",
        network: network.caip2,
        amount: atomicAmount,
        asset: tokenConfig.contractAddress,
        payTo: payTo as `0x${string}`,
        maxTimeoutSeconds,
        extra: {
          name: tokenConfig.name,
          version: tokenConfig.version,
        },
      });
    }
  }

  return { requirements };
}

export function simplePaymentMiddleware(config: SimplePaymentConfig) {
  const { requirements, error } = createSimpleRequirements(config);

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
      };

      c.status(402);
      c.header(V2_HEADERS.PAYMENT_REQUIRED, safeBase64Encode(JSON.stringify(paymentRequired)));
      return c.json({
        error: "Payment required",
        accepts: requirements,
      });
    }

    const payload = paymentHeader;

    let parsedPayload: unknown;
    try {
      const decoded = atob(payload);
      parsedPayload = JSON.parse(decoded);
    } catch {
      try {
        parsedPayload = JSON.parse(payload);
      } catch {
        c.status(400);
        return c.json({ error: "Invalid payment payload" });
      }
    }

    c.set("payment", {
      payload: parsedPayload,
      verified: false,
    });

    return next();
  };
}
