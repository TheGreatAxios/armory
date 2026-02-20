import type {
  PaymentRequirements,
  PaymentRequirementsV2,
} from "@armory-sh/base";
import {
  getNetworkByChainId,
  getNetworkConfig,
  normalizeNetworkName,
} from "@armory-sh/base";
import type { MiddlewareConfig } from "./types";

const toSlug = (network: string | number): string => {
  if (typeof network === "number") {
    const net = getNetworkByChainId(network);
    if (!net) throw new Error(`No network found for chainId: ${network}`);
    return normalizeNetworkName(net.name);
  }

  if (network.startsWith("eip155:")) {
    const chainPart = network.split(":")[1];
    if (!chainPart) throw new Error(`Invalid network format: ${network}`);
    const chainId = parseInt(chainPart, 10);
    const net = getNetworkByChainId(chainId);
    if (!net) throw new Error(`No network found for chainId: ${chainId}`);
    return normalizeNetworkName(net.name);
  }

  return normalizeNetworkName(network);
};

const toEip155 = (network: string | number): string => {
  if (typeof network === "number") {
    const net = getNetworkByChainId(network);
    if (!net) throw new Error(`No network found for chainId: ${network}`);
    return net.caip2Id;
  }

  if (network.startsWith("eip155:")) {
    const net = getNetworkConfig(network);
    if (!net) throw new Error(`No network found for: ${network}`);
    return net.caip2Id;
  }

  const slug = normalizeNetworkName(network);
  const net = getNetworkConfig(slug);
  if (!net) throw new Error(`No network found for: ${slug}`);
  return net.caip2Id;
};

const getNetworkName = (network: string | number): string => toSlug(network);

const getChainId = (network: string | number): string => toEip155(network);

const createV2Requirements = (
  config: MiddlewareConfig,
  expiry: number,
): PaymentRequirementsV2 => {
  const networkName = getNetworkName(config.network);
  const network = getNetworkConfig(networkName);
  if (!network) throw new Error(`Unsupported network: ${networkName}`);

  return {
    scheme: "exact",
    amount: config.amount,
    network: getChainId(config.network) as `eip155:${string}`,
    asset: network.usdcAddress,
    payTo: config.payTo,
    maxTimeoutSeconds: Math.max(1, expiry - Math.floor(Date.now() / 1000)),
    extra: {
      name: "USDC",
      version: "2",
    },
  };
};

export const createPaymentRequirements = (
  config: MiddlewareConfig,
): PaymentRequirements => {
  const networkName = getNetworkName(config.network);
  const network = getNetworkConfig(networkName);
  if (!network) throw new Error(`Unsupported network: ${networkName}`);
  const expiry = Math.floor(Date.now() / 1000) + 3600;

  return createV2Requirements(config, expiry);
};
