/**
 * Simple one-line middleware API for Armory merchants
 * Focus on DX/UX - "everything just magically works"
 */

import type {
  Address,
  PaymentRequirements,
  PaymentRequirementsV1,
  PaymentRequirementsV2,
} from "@armory-sh/base";
import type {
  NetworkId,
  TokenId,
  FacilitatorConfig,
  AcceptPaymentOptions,
  ResolvedPaymentConfig,
  ValidationError,
  PricingConfig,
} from "@armory-sh/base";
import {
  resolveNetwork,
  resolveToken,
  validateAcceptConfig,
  isValidationError,
  getNetworkConfig,
  getNetworkByChainId,
  normalizeNetworkName,
} from "@armory-sh/base";
import {
  createPaymentRequirements,
  createPaymentRequiredHeaders,
} from "./core";
import type { MiddlewareConfig, FacilitatorConfig as CoreFacilitatorConfig } from "./types";

// ═══════════════════════════════════════════════════════════════
// Simple Middleware Configuration
// ═══════════════════════════════════════════════════════════════

/**
 * Simple configuration for acceptPaymentsViaArmory middleware
 */
export interface SimpleMiddlewareConfig {
  /** Address to receive payments */
  payTo: Address;
  /** Default amount to charge (default: "1.0") */
  amount?: string;
  /** Payment acceptance options */
  accept?: AcceptPaymentOptions;
  /** Fallback facilitator URL (if not using accept.facilitators) */
  facilitatorUrl?: string;
  /** Per-network/token/facilitator pricing overrides */
  pricing?: PricingConfig[];
}

/**
 * Resolved middleware configuration with all options validated
 */
export interface ResolvedMiddlewareConfig {
  /** All valid payment configurations (network/token combinations) */
  configs: ResolvedPaymentConfigWithPricing[];
  /** Protocol version */
  version: 1 | 2 | "auto";
  /** Facilitator configs */
  facilitators: CoreFacilitatorConfig[];
}

/** Extended config with pricing info */
export interface ResolvedPaymentConfigWithPricing extends ResolvedPaymentConfig {
  /** Facilitator URL (for per-facilitator pricing) */
  facilitatorUrl?: string;
  /** Pricing config entry (if any) */
  pricing?: PricingConfig;
}

// ═══════════════════════════════════════════════════════════════
// Configuration Resolution
// ═══════════════════════════════════════════════════════════════

/**
 * Find matching pricing config for a network/token/facilitator combination
 */
const findPricingConfig = (
  pricing: PricingConfig[] | undefined,
  network: string,
  token: string,
  facilitatorUrl: string
): PricingConfig | undefined => {
  if (!pricing) return undefined;

  // First try exact match with facilitator
  const withFacilitator = pricing.find(
    p =>
      p.network === network &&
      p.token === token &&
      p.facilitator === facilitatorUrl
  );
  if (withFacilitator) return withFacilitator;

  // Then try network/token match (any facilitator)
  const withNetworkToken = pricing.find(
    p =>
      p.network === network &&
      p.token === token &&
      !p.facilitator
  );
  if (withNetworkToken) return withNetworkToken;

  // Then try network-only match
  const networkOnly = pricing.find(
    p => p.network === network && !p.token && !p.facilitator
  );
  if (networkOnly) return networkOnly;

  return undefined;
};

/**
 * Resolve simple middleware config to full config
 */
export const resolveMiddlewareConfig = (
  config: SimpleMiddlewareConfig
): ResolvedMiddlewareConfig | ValidationError => {
  const { payTo, amount = "1.0", accept = {}, facilitatorUrl, pricing } = config;

  // If using legacy facilitatorUrl, convert to AcceptPaymentOptions
  const acceptOptions: AcceptPaymentOptions = facilitatorUrl
    ? {
        ...accept,
        facilitators: accept.facilitators
          ? [...(Array.isArray(accept.facilitators) ? accept.facilitators : [accept.facilitators]), { url: facilitatorUrl }]
          : { url: facilitatorUrl },
      }
    : accept;

  const result = validateAcceptConfig(acceptOptions, payTo, amount);
  if (!result.success) {
    return result.error;
  }

  const facilitatorConfigs: CoreFacilitatorConfig[] = result.config[0]?.facilitators.map((f) => ({
    url: f.url,
    createHeaders: f.input.headers,
  })) ?? [];

  const enrichedConfigs: ResolvedPaymentConfigWithPricing[] = result.config.map((c) => {
    const networkName = normalizeNetworkName(normalizeNetworkName(c.network.config.name));
    const tokenSymbol = c.token.config.symbol;

    const facilitatorPricing: { url: string; pricing?: PricingConfig }[] = c.facilitators.map((f) => {
      const pricingConfig = findPricingConfig(pricing, networkName, tokenSymbol, f.url);
      return { url: f.url, pricing: pricingConfig };
    });

    const defaultPricing = findPricingConfig(pricing, networkName, tokenSymbol, "");

    return {
      ...c,
      amount: defaultPricing?.amount ?? c.amount,
      facilitatorUrl: facilitatorPricing[0]?.url,
      pricing: defaultPricing,
    };
  });

  return {
    configs: enrichedConfigs,
    version: acceptOptions.version ?? "auto",
    facilitators: facilitatorConfigs,
  };
};

/**
 * Get payment requirements for a specific network/token combination
 */
export const getRequirements = (
  config: ResolvedMiddlewareConfig,
  network: NetworkId,
  token: TokenId
): PaymentRequirements | ValidationError => {
  // Find matching config
  const resolvedNetwork = resolveNetwork(network);
  if (isValidationError(resolvedNetwork)) {
    return resolvedNetwork;
  }

  const resolvedToken = resolveToken(token, resolvedNetwork);
  if (isValidationError(resolvedToken)) {
    return resolvedToken;
  }

  const matchingConfig = config.configs.find(
    (c) =>
      c.network.config.chainId === resolvedNetwork.config.chainId &&
      c.token.config.contractAddress.toLowerCase() === resolvedToken.config.contractAddress.toLowerCase()
  );

  if (!matchingConfig) {
    return {
      code: "TOKEN_NOT_ON_NETWORK",
      message: `No configuration found for network "${network}" with token "${token}"`,
    } as ValidationError;
  }

  // Determine version
  const version = config.version === "auto" ? 2 : config.version;

  return createPaymentRequirements(
    {
      payTo: matchingConfig.payTo,
      network: normalizeNetworkName(normalizeNetworkName(matchingConfig.network.config.name)),
      amount: matchingConfig.amount,
      facilitator: config.facilitators[0],
    },
    version
  );
};

// ═══════════════════════════════════════════════════════════════
// Helper to get default config from first result
// ═══════════════════════════════════════════════════════════════

/**
 * Get primary/default middleware config for legacy middlewares
 */
export const getPrimaryConfig = (resolved: ResolvedMiddlewareConfig): MiddlewareConfig => {
  const primary = resolved.configs[0];
  if (!primary) {
    throw new Error("No valid payment configurations found");
  }

  return {
    payTo: primary.payTo,
    network: normalizeNetworkName(normalizeNetworkName(primary.network.config.name)),
    amount: primary.amount,
    facilitator: resolved.facilitators[0],
    settlementMode: "settle",
  };
};

/**
 * Get all supported networks from config
 */
export const getSupportedNetworks = (config: ResolvedMiddlewareConfig): string[] => {
  const networks = new Set(config.configs.map((c) => normalizeNetworkName(normalizeNetworkName(c.network.config.name))));
  return Array.from(networks);
};

/**
 * Get all supported tokens from config
 */
export const getSupportedTokens = (config: ResolvedMiddlewareConfig): string[] => {
  const tokens = new Set(config.configs.map((c) => c.token.config.symbol));
  return Array.from(tokens);
};

/**
 * Check if a network/token combination is supported
 */
export const isSupported = (
  config: ResolvedMiddlewareConfig,
  network: NetworkId,
  token: TokenId
): boolean => {
  const resolvedNetwork = resolveNetwork(network);
  if (isValidationError(resolvedNetwork)) {
    return false;
  }

  const resolvedToken = resolveToken(token, resolvedNetwork);
  if (isValidationError(resolvedToken)) {
    return false;
  }

  return config.configs.some(
    (c) =>
      c.network.config.chainId === resolvedNetwork.config.chainId &&
      c.token.config.contractAddress.toLowerCase() === resolvedToken.config.contractAddress.toLowerCase()
  );
};
