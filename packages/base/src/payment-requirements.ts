import type {
  NetworkId,
  ResolvedNetwork,
  ResolvedToken,
  TokenId,
  ValidationError,
} from "./types/api";
import { getNetworkConfig } from "./types/networks";
import { getToken } from "./data/tokens";
import type { Address, PaymentRequirementsV2 } from "./types/v2";
import { toAtomicUnits } from "./utils/x402";
import {
  normalizeNetworkName,
  resolveNetwork,
  resolveToken,
} from "./validation";

export interface PaymentConfig {
  payTo: Address | string;
  chains?: NetworkId[];
  chain?: NetworkId;
  tokens?: TokenId[];
  token?: TokenId;
  amount?: string;
  amounts?: Record<string, string>;
  maxTimeoutSeconds?: number;

  payToByChain?: Record<string, Address | string>;
  payToByToken?: Record<string, Record<string, Address | string>>;

  facilitatorUrl?: string;
  facilitatorUrlByChain?: Record<string, string>;
  facilitatorUrlByToken?: Record<string, Record<string, string>>;
}

function resolveAmountForNetwork(
  config: PaymentConfig,
  network: ResolvedNetwork,
): string {
  const defaultAmount = config.amount ?? "0.01";
  if (!config.amounts) {
    return defaultAmount;
  }

  const explicitDefault = config.amounts.default;
  const fallbackAmount = explicitDefault ?? defaultAmount;

  for (const [networkKey, amount] of Object.entries(config.amounts)) {
    if (networkKey === "default") {
      continue;
    }

    const resolvedNetwork = resolveNetwork(networkKey);
    if (
      !isValidationError(resolvedNetwork) &&
      resolvedNetwork.config.chainId === network.config.chainId
    ) {
      return amount;
    }
  }

  return fallbackAmount;
}

export interface ResolvedRequirementsConfig {
  requirements: PaymentRequirementsV2[];
  error?: ValidationError;
}

export interface FacilitatorRoutingConfig {
  facilitatorUrl?: string;
  facilitatorUrlByChain?: Record<string, string>;
  facilitatorUrlByToken?: Record<string, Record<string, string>>;
}

const DEFAULT_NETWORKS: NetworkId[] = [
  "ethereum",
  "base",
  "base-sepolia",
  "skale-base",
  "skale-base-sepolia",
  "ethereum-sepolia",
];

const DEFAULT_TOKENS: TokenId[] = ["usdc"];

const isValidationError = (value: unknown): value is ValidationError => {
  return typeof value === "object" && value !== null && "code" in value;
};

const coerceMetadata = (
  requirement: PaymentRequirementsV2,
): { name?: string; version?: string } => {
  if (typeof requirement.name === "string" && typeof requirement.version === "string") {
    return { name: requirement.name, version: requirement.version };
  }

  const extraName =
    requirement.extra &&
    typeof requirement.extra === "object" &&
    typeof requirement.extra.name === "string"
      ? requirement.extra.name
      : undefined;
  const extraVersion =
    requirement.extra &&
    typeof requirement.extra === "object" &&
    typeof requirement.extra.version === "string"
      ? requirement.extra.version
      : undefined;

  return { name: extraName, version: extraVersion };
};

const resolveTokenMetadata = (
  requirement: PaymentRequirementsV2,
): { name?: string; version?: string } => {
  const chainId = parseInt(requirement.network.split(":")[1] || "0", 10);
  if (!Number.isFinite(chainId) || chainId <= 0) {
    return {};
  }

  const token = getToken(chainId, requirement.asset);
  if (!token) {
    return {};
  }

  return {
    name: token.name,
    version: token.version,
  };
};

export function enrichPaymentRequirement(
  requirement: PaymentRequirementsV2,
): PaymentRequirementsV2 {
  const metadata = coerceMetadata(requirement);
  const fallback = resolveTokenMetadata(requirement);
  const name = metadata.name ?? fallback.name;
  const version = metadata.version ?? fallback.version;

  if (!name || !version) {
    return requirement;
  }

  return {
    ...requirement,
    name,
    version,
    extra: {
      ...(requirement.extra ?? {}),
      name,
      version,
    },
  };
}

export function enrichPaymentRequirements(
  requirements: PaymentRequirementsV2[],
): PaymentRequirementsV2[] {
  return requirements.map(enrichPaymentRequirement);
}

function resolvePayTo(
  config: PaymentConfig,
  network: ResolvedNetwork,
  token: ResolvedToken,
): Address | string {
  const chainId = network.config.chainId;

  if (config.payToByToken) {
    for (const [chainKey, tokenMap] of Object.entries(config.payToByToken)) {
      const resolvedChain = resolveNetwork(chainKey);
      if (
        !isValidationError(resolvedChain) &&
        resolvedChain.config.chainId === chainId
      ) {
        for (const [tokenKey, address] of Object.entries(tokenMap)) {
          const resolvedToken = resolveToken(tokenKey, network);
          if (
            !isValidationError(resolvedToken) &&
            resolvedToken.config.contractAddress.toLowerCase() ===
              token.config.contractAddress.toLowerCase()
          ) {
            return address;
          }
        }
      }
    }
  }

  if (config.payToByChain) {
    for (const [chainKey, address] of Object.entries(config.payToByChain)) {
      const resolvedChain = resolveNetwork(chainKey);
      if (
        !isValidationError(resolvedChain) &&
        resolvedChain.config.chainId === chainId
      ) {
        return address;
      }
    }
  }

  return config.payTo;
}

function resolveFacilitatorUrl(
  config: PaymentConfig,
  network: ResolvedNetwork,
  token: ResolvedToken,
): string | undefined {
  const chainId = network.config.chainId;

  if (config.facilitatorUrlByToken) {
    for (const [chainKey, tokenMap] of Object.entries(
      config.facilitatorUrlByToken,
    )) {
      const resolvedChain = resolveNetwork(chainKey);
      if (
        !isValidationError(resolvedChain) &&
        resolvedChain.config.chainId === chainId
      ) {
        for (const [tokenKey, url] of Object.entries(tokenMap)) {
          const resolvedToken = resolveToken(tokenKey, network);
          if (
            !isValidationError(resolvedToken) &&
            resolvedToken.config.contractAddress.toLowerCase() ===
              token.config.contractAddress.toLowerCase()
          ) {
            return url;
          }
        }
      }
    }
  }

  if (config.facilitatorUrlByChain) {
    for (const [chainKey, url] of Object.entries(
      config.facilitatorUrlByChain,
    )) {
      const resolvedChain = resolveNetwork(chainKey);
      if (
        !isValidationError(resolvedChain) &&
        resolvedChain.config.chainId === chainId
      ) {
        return url;
      }
    }
  }

  return config.facilitatorUrl;
}

export function resolveFacilitatorUrlFromRequirement(
  config: FacilitatorRoutingConfig,
  requirement: Pick<PaymentRequirementsV2, "network" | "asset">,
): string | undefined {
  const chainId = parseInt(requirement.network.split(":")[1] || "0", 10);
  const assetAddress = requirement.asset.toLowerCase();

  if (config.facilitatorUrlByToken) {
    for (const [chainKey, tokenMap] of Object.entries(
      config.facilitatorUrlByToken,
    )) {
      const resolvedChain = resolveNetwork(chainKey);
      if (
        isValidationError(resolvedChain) ||
        resolvedChain.config.chainId !== chainId
      ) {
        continue;
      }

      for (const [tokenKey, url] of Object.entries(tokenMap)) {
        const resolvedToken = resolveToken(tokenKey, resolvedChain);
        if (
          !isValidationError(resolvedToken) &&
          resolvedToken.config.contractAddress.toLowerCase() === assetAddress
        ) {
          return url;
        }
      }
    }
  }

  if (config.facilitatorUrlByChain) {
    for (const [chainKey, url] of Object.entries(
      config.facilitatorUrlByChain,
    )) {
      const resolvedChain = resolveNetwork(chainKey);
      if (
        !isValidationError(resolvedChain) &&
        resolvedChain.config.chainId === chainId
      ) {
        return url;
      }
    }
  }

  return config.facilitatorUrl;
}

function resolveNetworks(chainInputs: NetworkId[] | undefined): {
  networks: ResolvedNetwork[];
  error?: ValidationError;
} {
  const resolvedNetworks: ResolvedNetwork[] = [];
  const errors: string[] = [];

  const networks = chainInputs?.length ? chainInputs : DEFAULT_NETWORKS;

  for (const networkId of networks) {
    const resolved = resolveNetwork(networkId);
    if (isValidationError(resolved)) {
      errors.push(`Network "${networkId}": ${resolved.message}`);
    } else {
      resolvedNetworks.push(resolved);
    }
  }

  if (errors.length > 0) {
    return {
      networks: resolvedNetworks,
      error: {
        code: "VALIDATION_FAILED",
        message: errors.join("; "),
      },
    };
  }

  return { networks: resolvedNetworks };
}

export function createPaymentRequirements(
  config: PaymentConfig,
): ResolvedRequirementsConfig {
  const {
    payTo,
    chains,
    chain,
    tokens,
    token,
    maxTimeoutSeconds = 300,
  } = config;

  const chainInputs = chain ? [chain] : chains;
  const tokenInputs = token ? [token] : tokens;

  const { networks, error: networksError } = resolveNetworks(chainInputs);
  if (networksError) {
    return { requirements: [], error: networksError };
  }

  const requirements: PaymentRequirementsV2[] = [];

  for (const network of networks) {
    const tokensToResolve = tokenInputs?.length ? tokenInputs : DEFAULT_TOKENS;
    const resolvedAmount = resolveAmountForNetwork(config, network);
    const atomicAmount = toAtomicUnits(resolvedAmount);

    for (const tokenId of tokensToResolve) {
      const resolvedToken = resolveToken(tokenId, network);
      if (isValidationError(resolvedToken)) {
        continue;
      }

      const tokenConfig = resolvedToken.config;

      const resolvedPayTo = resolvePayTo(config, network, resolvedToken);
      const resolvedFacilitatorUrl = resolveFacilitatorUrl(
        config,
        network,
        resolvedToken,
      );

      const requirement: PaymentRequirementsV2 = {
        scheme: "exact",
        network: network.caip2,
        amount: atomicAmount,
        asset: tokenConfig.contractAddress,
        payTo: resolvedPayTo as `0x${string}`,
        maxTimeoutSeconds,
        name: tokenConfig.name,
        version: tokenConfig.version,
        extra: {
          name: tokenConfig.name,
          version: tokenConfig.version,
        },
      };

      requirements.push(requirement);
    }
  }

  if (requirements.length === 0) {
    return {
      requirements: [],
      error: {
        code: "VALIDATION_FAILED",
        message: "No valid network/token combinations found",
      },
    };
  }

  return { requirements };
}

export function findRequirementByNetwork(
  requirements: PaymentRequirementsV2[],
  network: string,
): PaymentRequirementsV2 | undefined {
  const normalized = normalizeNetworkName(network);
  const netConfig = getNetworkConfig(normalized);
  if (!netConfig) return undefined;

  return requirements.find((r) => r.network === netConfig.caip2Id);
}

export function findRequirementByAccepted(
  requirements: PaymentRequirementsV2[],
  accepted: {
    scheme: string;
    network: string;
    amount: string;
    asset: string;
    payTo: string;
  },
): PaymentRequirementsV2 | undefined {
  const acceptedPayTo =
    typeof accepted.payTo === "string" ? accepted.payTo.toLowerCase() : "";
  const exactMatch = requirements.find(
    (requirement) =>
      requirement.scheme === accepted.scheme &&
      requirement.network === accepted.network &&
      requirement.amount === accepted.amount &&
      requirement.asset.toLowerCase() === accepted.asset.toLowerCase() &&
      typeof requirement.payTo === "string" &&
      requirement.payTo.toLowerCase() === acceptedPayTo,
  );
  if (exactMatch) {
    return exactMatch;
  }

  const payToAwareMatch = requirements.find(
    (requirement) =>
      requirement.scheme === accepted.scheme &&
      requirement.network === accepted.network &&
      acceptedPayTo.length > 0 &&
      typeof requirement.payTo === "string" &&
      requirement.payTo.toLowerCase() === acceptedPayTo,
  );
  if (payToAwareMatch) {
    return payToAwareMatch;
  }

  return requirements.find(
    (requirement) =>
      requirement.scheme === accepted.scheme &&
      requirement.network === accepted.network,
  );
}
