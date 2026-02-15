/**
 * Comprehensive validation for Armory configurations
 * Ensures networks, tokens, and facilitators are compatible
 */

import { type as arkType } from "arktype";
import type {
  NetworkConfig,
  CustomToken,
} from "./types/networks";
import type { CAIPAssetId } from "./types/v2";
import type {
  NetworkId,
  TokenId,
  FacilitatorConfig,
  ResolvedNetwork,
  ResolvedToken,
  ResolvedFacilitator,
  ResolvedPaymentConfig,
  ValidationError,
  PaymentErrorCode,
} from "./types/simple";

// ═══════════════════════════════════════════════════════════════
// ArkType Schemas
// ═══════════════════════════════════════════════════════════════

export const CustomTokenSchema = arkType({
  symbol: "string",
  name: "string",
  version: "string",
  contractAddress: "/^0x[a-fA-F0-9]{40}$/",
  chainId: "number.integer > 0",
  decimals: "number.integer >= 0?",
});

const NetworkIdSchema = arkType("string | number | object");

const TokenIdSchema = arkType("string | number | object");

import {
  NETWORKS,
  getNetworkConfig,
  getNetworkByChainId,
  getCustomToken,
  getAllCustomTokens,
} from "./types/networks";

// ═══════════════════════════════════════════════════════════════
// Error Creation
// ═══════════════════════════════════════════════════════════════

export const createError = (
  code: PaymentErrorCode,
  message: string,
  details?: Partial<ValidationError>
): ValidationError => ({
  code,
  message,
  ...details,
});

// ═══════════════════════════════════════════════════════════════
// Network Resolution & Validation
// ═══════════════════════════════════════════════════════════════

export const normalizeNetworkName = (name: string): string =>
  name.toLowerCase()
    .replace(/\s+/g, "-")
    .replace("-mainnet", "")
    .replace(/-mainnet/, "")
    .replace("mainnet-", "")
    .replace(/-sepolia$/, "-sepolia")
    .replace(/^-|-$/g, "");

export const resolveNetwork = (input: unknown): ResolvedNetwork | ValidationError => {
  const inputCheck = NetworkIdSchema(input);
  if (inputCheck instanceof arkType.errors) {
    return createError(
      "VALIDATION_FAILED",
      "Invalid network input type",
      { value: input, validOptions: ["string (name/CAIP-2)", "number (chainId)", "NetworkConfig"] }
    );
  }

  if (typeof input === "object" && input !== null && "chainId" in input) {
    const config = input as NetworkConfig;
    if (!config.chainId || !config.usdcAddress || !config.caip2Id) {
      return createError("INVALID_CAIP_FORMAT", "Invalid network config", { value: config });
    }
    return {
      input: input as unknown as NetworkId,
      config,
      caip2: config.caip2Id as `eip155:${number}`,
    };
  }

  if (typeof input === "number") {
    const config = getNetworkByChainId(input);
    if (!config) {
      const validChainIds = Object.values(NETWORKS).map((n) => n.chainId);
      return createError(
        "UNKNOWN_NETWORK",
        `Unknown chain ID: ${input}`,
        { value: input, validOptions: validChainIds.map(String) }
      );
    }
    return {
      input,
      config,
      caip2: config.caip2Id as `eip155:${number}`,
    };
  }

  if (typeof input === "string") {
    if (input.startsWith("eip155:")) {
      const parts = input.split(":");
      if (parts.length !== 2 || isNaN(Number(parts[1]))) {
        return createError("INVALID_CAIP_FORMAT", `Invalid CAIP-2 format: ${input}`, { value: input });
      }
      const chainId = Number(parts[1]);
      const config = getNetworkByChainId(chainId);
      if (!config) {
        return createError("UNKNOWN_NETWORK", `Unknown CAIP-2 network: ${input}`, { value: input });
      }
      return {
        input,
        config,
        caip2: input as `eip155:${number}`,
      };
    }

    const normalizedName = normalizeNetworkName(input);
    const config = getNetworkConfig(normalizedName);
    if (!config) {
      const validNames = Object.keys(NETWORKS);
      return createError(
        "UNKNOWN_NETWORK",
        `Unknown network: "${input}"`,
        { value: input, validOptions: validNames }
      );
    }
    return {
      input,
      config,
      caip2: config.caip2Id as `eip155:${number}`,
    };
  }

  return createError("UNKNOWN_NETWORK", `Invalid network identifier type: ${typeof input}`, { value: input });
};

export const getAvailableNetworks = (): string[] => Object.keys(NETWORKS);

// ═══════════════════════════════════════════════════════════════
// Token Resolution & Validation
// ═══════════════════════════════════════════════════════════════

const normalizeTokenSymbol = (symbol: string): string => symbol.toUpperCase();

const isEvmAddress = (value: string): boolean =>
  /^0x[a-fA-F0-9]{40}$/.test(value);

export const resolveToken = (
  input: unknown,
  network?: ResolvedNetwork
): ResolvedToken | ValidationError => {
  const inputCheck = TokenIdSchema(input);
  if (inputCheck instanceof arkType.errors) {
    return createError(
      "VALIDATION_FAILED",
      "Invalid token input type",
      { value: input, validOptions: ["string (symbol/address/CAIP Asset)", "number (deprecated)", "CustomToken"] }
    );
  }

  if (typeof input === "object" && input !== null && "contractAddress" in input) {
    const config = input as CustomToken;
    if (!config.chainId || !config.contractAddress || !config.symbol) {
      return createError("VALIDATION_FAILED", "Invalid token config", { value: config });
    }

    if (network && config.chainId !== network.config.chainId) {
      return createError(
        "TOKEN_NOT_ON_NETWORK",
        `Token ${config.symbol} is on chain ${config.chainId}, but expected chain ${network.config.chainId}`,
        { value: config }
      );
    }

    const tokenNetwork = resolveNetwork(config.chainId);
    if ("code" in tokenNetwork) {
      return tokenNetwork;
    }

    const caipAsset = `eip155:${config.chainId}/erc20:${config.contractAddress}` as CAIPAssetId;

    return {
      input: input as unknown as TokenId,
      config,
      caipAsset,
      network: tokenNetwork,
    };
  }

  if (typeof input === "string") {
    if (isEvmAddress(input)) {
      const contractAddress = input as `0x${string}`;

      if (network) {
        const customToken = getCustomToken(network.config.chainId, contractAddress);
        const config = customToken || {
          symbol: "CUSTOM",
          name: "Custom Token",
          version: "1",
          chainId: network.config.chainId,
          contractAddress,
          decimals: 18,
        };

        const caipAsset: CAIPAssetId = `eip155:${network.config.chainId}/erc20:${contractAddress}`;

        return {
          input,
          config,
          caipAsset,
          network,
        };
      }

      const customTokens = getAllCustomTokens();
      const matchingToken = customTokens.find(
        (t) => t.contractAddress.toLowerCase() === contractAddress.toLowerCase()
      );

      if (matchingToken) {
        const tokenNetwork = resolveNetwork(matchingToken.chainId);
        if ("code" in tokenNetwork) {
          return tokenNetwork;
        }

        const caipAsset: CAIPAssetId = `eip155:${matchingToken.chainId}/erc20:${contractAddress}`;

        return {
          input,
          config: matchingToken,
          caipAsset,
          network: tokenNetwork,
        };
      }

      return createError(
        "UNKNOWN_TOKEN",
        `Token address "${contractAddress}" not found in registry. Please specify a network.`,
        { value: input, validOptions: ["Specify network parameter"] }
      );
    }

    if (input.includes("/erc20:")) {
      const parts = input.split("/");
      if (parts.length !== 2) {
        return createError("INVALID_CAIP_FORMAT", `Invalid CAIP Asset ID format: ${input}`, { value: input });
      }
      const chainId = Number(parts[0].split(":")[1]);
      const contractAddress = parts[1].split(":")[1] as `0x${string}`;

      const tokenNetwork = resolveNetwork(chainId);
      if ("code" in tokenNetwork) {
        return tokenNetwork;
      }

      const customToken = getCustomToken(chainId, contractAddress);
      const config = customToken || {
        symbol: "CUSTOM",
        name: "Custom Token",
        version: "1",
        chainId,
        contractAddress,
        decimals: 18,
      };

      return {
        input,
        config,
        caipAsset: input as `eip155:${number}/erc20:${string}`,
        network: tokenNetwork,
      };
    }

    const normalizedSymbol = normalizeTokenSymbol(input);

    if (network) {
      const customTokens = getAllCustomTokens();
      const matchingToken = customTokens.find(
        (t) => t.symbol?.toUpperCase() === normalizedSymbol && t.chainId === network.config.chainId
      );

      if (matchingToken) {
        return {
          input,
          config: matchingToken,
          caipAsset: `eip155:${matchingToken.chainId}/erc20:${matchingToken.contractAddress}` as const,
          network,
        };
      }

      return {
        input,
        config: {
          symbol: normalizedSymbol,
          name: network.config.name + " " + normalizedSymbol,
          version: "2",
          chainId: network.config.chainId,
          contractAddress: network.config.usdcAddress,
          decimals: 6,
        },
        caipAsset: network.config.caipAssetId as `eip155:${number}/erc20:${string}`,
        network,
      };
    }

    const customTokens = getAllCustomTokens();
    const matchingToken = customTokens.find((t) => t.symbol?.toUpperCase() === normalizedSymbol);

    if (matchingToken) {
      const tokenNetwork = resolveNetwork(matchingToken.chainId);
      if ("code" in tokenNetwork) {
        return tokenNetwork;
      }
      return {
        input,
        config: matchingToken,
        caipAsset: `eip155:${matchingToken.chainId}/erc20:${matchingToken.contractAddress}` as const,
        network: tokenNetwork,
      };
    }

    const baseNetwork = resolveNetwork("base");
    if ("code" in baseNetwork) {
      return baseNetwork;
    }

    return {
      input,
      config: {
        symbol: normalizedSymbol,
        name: "USD Coin",
        version: "2",
        chainId: 8453,
        contractAddress: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
        decimals: 6,
      },
      caipAsset: baseNetwork.config.caipAssetId as `eip155:${number}/erc20:${string}`,
      network: baseNetwork,
    };
  }

  return createError("UNKNOWN_TOKEN", `Invalid token identifier type: ${typeof input}`, { value: input });
};

export const getAvailableTokens = (): string[] => {
  const customTokens = getAllCustomTokens();
  const symbols = new Set(customTokens.map((t) => t.symbol.toUpperCase()));
  return Array.from(symbols);
};

// ═══════════════════════════════════════════════════════════════
// Facilitator Resolution & Validation
// ═══════════════════════════════════════════════════════════════

export const resolveFacilitator = (
  input: FacilitatorConfig,
  supportedNetworks?: ResolvedNetwork[],
  supportedTokens?: ResolvedToken[]
): ResolvedFacilitator | ValidationError => {
  try {
    new URL(input.url);
  } catch {
    return createError("VALIDATION_FAILED", `Invalid facilitator URL: ${input.url}`, { value: input.url });
  }

  const networks: ResolvedNetwork[] = [];
  if (input.networks) {
    for (const network of input.networks) {
      const resolved = resolveNetwork(network);
      if ("code" in resolved) {
        return resolved;
      }
      networks.push(resolved);
    }
  } else if (supportedNetworks) {
    networks.push(...supportedNetworks);
  }

  const tokens: ResolvedToken[] = [];
  if (input.tokens) {
    for (const token of input.tokens) {
      for (const network of networks.length > 0 ? networks : supportedNetworks || []) {
        const resolved = resolveToken(token, network);
        if ("code" in resolved) {
          continue;
        }
        tokens.push(resolved);
        break;
      }
    }
  } else if (supportedTokens) {
    tokens.push(...supportedTokens);
  }

  return {
    input,
    url: input.url,
    networks,
    tokens,
  };
};

export const checkFacilitatorSupport = (
  facilitator: ResolvedFacilitator,
  network: ResolvedNetwork,
  token: ResolvedToken
): ValidationError | { supported: true } => {
  if (facilitator.networks.length > 0) {
    const networkSupported = facilitator.networks.some(
      (n) => n.config.chainId === network.config.chainId
    );

    if (!networkSupported) {
      const supportedNames = facilitator.networks.map((n) => n.config.name);
      return createError(
        "FACILITATOR_NO_NETWORK_SUPPORT",
        `Facilitator "${facilitator.url}" does not support network "${network.config.name}" (chain ${network.config.chainId}). Supported: ${supportedNames.join(", ")}`,
        {
          value: { facilitator: facilitator.url, network: network.config.name },
          validOptions: supportedNames,
        }
      );
    }
  }

  if (facilitator.tokens.length > 0) {
    const tokenSupported = facilitator.tokens.some(
      (t) =>
        t.config.contractAddress.toLowerCase() === token.config.contractAddress.toLowerCase() &&
        t.network.config.chainId === token.network.config.chainId
    );

    if (!tokenSupported) {
      const supportedTokens = facilitator.tokens.map((t) => `${t.config.symbol} (${t.network.config.name})`);
      return createError(
        "FACILITATOR_NO_TOKEN_SUPPORT",
        `Facilitator "${facilitator.url}" does not support token "${token.config.symbol}" on "${token.network.config.name}". Supported: ${supportedTokens.join(", ")}`,
        {
          value: { facilitator: facilitator.url, token: token.config.symbol, network: token.network.config.name },
          validOptions: supportedTokens,
        }
      );
    }
  }

  return { supported: true };
};

// ═══════════════════════════════════════════════════════════════
// Full Configuration Validation
// ═══════════════════════════════════════════════════════════════

export const validatePaymentConfig = (
  network: NetworkId,
  token: TokenId,
  facilitators?: FacilitatorConfig | FacilitatorConfig[],
  payTo: string = "0x0000000000000000000000000000000000000000",
  amount: string = "1.0"
): ResolvedPaymentConfig | ValidationError => {
  const resolvedNetwork = resolveNetwork(network);
  if ("code" in resolvedNetwork) {
    return resolvedNetwork;
  }

  const resolvedToken = resolveToken(token, resolvedNetwork);
  if ("code" in resolvedToken) {
    return resolvedToken;
  }

  const resolvedFacilitators: ResolvedFacilitator[] = [];
  if (facilitators) {
    const facilitatorArray = Array.isArray(facilitators) ? facilitators : [facilitators];
    for (const facilitator of facilitatorArray) {
      const resolved = resolveFacilitator(facilitator, [resolvedNetwork], [resolvedToken]);
      if ("code" in resolved) {
        return resolved;
      }

      const supportCheck = checkFacilitatorSupport(resolved, resolvedNetwork, resolvedToken);
      if ("code" in supportCheck) {
        return supportCheck;
      }

      resolvedFacilitators.push(resolved);
    }
  }

  return {
    network: resolvedNetwork,
    token: resolvedToken,
    facilitators: resolvedFacilitators,
    version: "auto",
    payTo: payTo as `0x${string}`,
    amount,
  };
};

export const validateAcceptConfig = (
  options: {
    networks?: NetworkId[];
    tokens?: TokenId[];
    facilitators?: FacilitatorConfig | FacilitatorConfig[];
    version?: 1 | 2 | "auto";
  },
  payTo: string,
  amount: string
):
  | { success: true; config: ResolvedPaymentConfig[] }
  | { success: false; error: ValidationError } => {
  const { networks: networkInputs, tokens: tokenInputs, facilitators, version = "auto" } = options;

  const networkIds = networkInputs?.length ? networkInputs : Object.keys(NETWORKS);
  const tokenIds = tokenInputs?.length ? tokenInputs : ["usdc"];

  const networks: ResolvedNetwork[] = [];
  for (const networkId of networkIds) {
    const resolved = resolveNetwork(networkId);
    if ("code" in resolved) {
      return { success: false, error: resolved };
    }
    networks.push(resolved);
  }

  const tokens: ResolvedToken[] = [];
  for (const tokenId of tokenIds) {
    let found = false;
    for (const network of networks) {
      const resolved = resolveToken(tokenId, network);
      if ("code" in resolved) {
        continue;
      }
      tokens.push(resolved);
      found = true;
      break;
    }
    if (!found) {
      return {
        success: false,
        error: createError(
          "TOKEN_NOT_ON_NETWORK",
          `Token "${String(tokenId)}" not found on any of the specified networks`,
          { value: tokenId, validOptions: networks.map((n) => n.config.name) }
        ),
      };
    }
  }

  const facilitatorArray = facilitators ? (Array.isArray(facilitators) ? facilitators : [facilitators]) : [];
  const resolvedFacilitators: ResolvedFacilitator[] = [];
  for (const facilitator of facilitatorArray) {
    const resolved = resolveFacilitator(facilitator, networks, tokens);
    if ("code" in resolved) {
      return { success: false, error: resolved };
    }
    resolvedFacilitators.push(resolved);
  }

  const configs: ResolvedPaymentConfig[] = [];
  for (const network of networks) {
    for (const token of tokens) {
      if (token.network.config.chainId === network.config.chainId) {
        configs.push({
          network,
          token,
          facilitators: resolvedFacilitators,
          version,
          payTo: payTo as `0x${string}`,
          amount,
        });
      }
    }
  }

  return { success: true, config: configs };
};

// ═══════════════════════════════════════════════════════════════
// Type Guards
// ═══════════════════════════════════════════════════════════════

export const isValidationError = (value: unknown): value is ValidationError => {
  return typeof value === "object" && value !== null && "code" in value;
};

export const isResolvedNetwork = (value: unknown): value is ResolvedNetwork => {
  return typeof value === "object" && value !== null && "config" in value && "caip2" in value;
};

export const isResolvedToken = (value: unknown): value is ResolvedToken => {
  return typeof value === "object" && value !== null && "config" in value && "caipAsset" in value;
};
