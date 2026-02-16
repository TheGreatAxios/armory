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
  X402PaymentPayload,
  VerifyResponse,
  X402SettlementResponse,
} from "@armory-sh/base";
import {
  resolveNetwork,
  resolveToken,
  safeBase64Encode,
  V2_HEADERS,
  registerToken,
  createPaymentRequiredHeaders,
  createSettlementHeaders,
  decodePayloadHeader,
  verifyPayment,
  settlePayment,
} from "@armory-sh/base";
import type { ResolvedNetwork, ResolvedToken, ValidationError } from "@armory-sh/base";
import {
  TOKENS,
} from "@armory-sh/base";
import type { ExtensionConfig } from "./extensions";
import { buildExtensions } from "./extensions";

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

export function resolveFacilitatorUrlFromRequirement(
  config: PaymentConfig,
  requirement: PaymentRequirementsV2
): string | undefined {
  const chainId = parseInt(requirement.network.split(":")[1] || "0", 10);
  const assetAddress = requirement.asset.toLowerCase();

  if (config.facilitatorUrlByToken) {
    for (const [chainKey, tokenMap] of Object.entries(config.facilitatorUrlByToken)) {
      const resolvedChain = resolveNetwork(chainKey);
      if (!isValidationError(resolvedChain) && resolvedChain.config.chainId === chainId) {
        for (const [, url] of Object.entries(tokenMap)) {
          const network = resolveNetwork(chainKey);
          if (!isValidationError(network)) {
            for (const tokenKey of Object.keys(tokenMap)) {
              const resolvedToken = resolveToken(tokenKey, network);
              if (!isValidationError(resolvedToken) && resolvedToken.config.contractAddress.toLowerCase() === assetAddress) {
                return url;
              }
            }
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
        },
      });
    }
  }

  return { requirements };
}

export function paymentMiddleware(config: PaymentConfig) {
  const { requirements, error } = createPaymentRequirements(config);

  console.log("[payment-middleware] Initialized with requirements:", JSON.stringify(requirements, null, 2));

  return async (c: Context, next: Next): Promise<Response | void> => {
    if (error) {
      console.log("[payment-middleware] Configuration error:", error.message);
      c.status(500);
      return c.json({
        error: "Payment middleware configuration error",
        details: error.message,
      });
    }

    const paymentHeader = c.req.header(V2_HEADERS.PAYMENT_SIGNATURE);
    console.log("[payment-middleware] Payment header present:", !!paymentHeader);

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

      console.log("[payment-middleware] Returning 402 with requirements:", JSON.stringify(paymentRequired.accepts, null, 2));
      c.status(402);
      c.header(V2_HEADERS.PAYMENT_REQUIRED, safeBase64Encode(JSON.stringify(paymentRequired)));
      return c.json({
        error: "Payment required",
        accepts: requirements,
      });
    }

    const primaryRequirement = requirements[0];
    if (!primaryRequirement) {
      console.log("[payment-middleware] No requirements configured");
      c.status(500);
      return c.json({ error: "Payment middleware configuration error", details: "No payment requirements configured" });
    }

    console.log("[payment-middleware] Primary requirement:", JSON.stringify(primaryRequirement, null, 2));

    let parsedPayload: X402PaymentPayload;
    try {
      parsedPayload = decodePayloadHeader(paymentHeader, {
        accepted: primaryRequirement,
      });
    } catch {
      c.status(400);
      return c.json({ error: "Invalid payment payload" });
    }

    const facilitatorUrl = resolveFacilitatorUrlFromRequirement(config, primaryRequirement);

    console.log("[payment-middleware] Facilitator URL:", facilitatorUrl);

    if (!facilitatorUrl) {
      console.log("[payment-middleware] No facilitator URL configured");
      c.status(500);
      return c.json({ error: "Payment middleware configuration error", message: "Facilitator URL is required for verification" });
    }

    console.log("[payment-middleware] Verifying payment with facilitator...");
    const verifyResult: VerifyResponse = await verifyPayment(parsedPayload, primaryRequirement, { url: facilitatorUrl });
    console.log("[payment-middleware] Verify result:", JSON.stringify(verifyResult, null, 2));

    if (!verifyResult.isValid) {
      console.log("[payment-middleware] Verification failed:", verifyResult.invalidReason);
      c.status(402);
      c.header(V2_HEADERS.PAYMENT_REQUIRED, createPaymentRequiredHeaders(requirements)[V2_HEADERS.PAYMENT_REQUIRED]);
      return c.json({ error: "Payment verification failed", message: verifyResult.invalidReason });
    }

    console.log("[payment-middleware] Payment verified, setting payment context");
    c.set("payment", {
      payload: parsedPayload,
      payerAddress: verifyResult.payer,
      verified: true,
    });

    await next();

    if (c.res.status >= 400) {
      return;
    }

    console.log("[payment-middleware] Settling payment...");
    const settleResult: X402SettlementResponse = await settlePayment(parsedPayload, primaryRequirement, { url: facilitatorUrl });
    console.log("[payment-middleware] Settle result:", JSON.stringify(settleResult, null, 2));

    if (!settleResult.success) {
      console.log("[payment-middleware] Settlement failed:", settleResult.errorReason);
      c.status(502);
      c.res = c.json({ error: "Settlement failed", details: settleResult.errorReason }, 502);
      return;
    }

    console.log("[payment-middleware] Payment settled, tx:", settleResult.transaction);
    const headers = createSettlementHeaders(settleResult);
    for (const [key, value] of Object.entries(headers)) {
      c.header(key, value);
    }
  };
}
