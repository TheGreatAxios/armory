import type { PaymentRequirements, PaymentRequirementsV2, PayToV2 } from "@armory-sh/base";
import { getNetworkConfig, getNetworkByChainId, normalizeNetworkName } from "@armory-sh/base";
import type { MiddlewareConfig } from "./types";

const toSlug = (network: string | number): string => {
  if (typeof network === "number") {
    const net = getNetworkByChainId(network);
    if (!net) throw new Error(`No network found for chainId: ${network}`);
    return normalizeNetworkName(net.name);
  }

  if (network.startsWith("eip155:")) {
    const chainId = parseInt(network.split(":")[1], 10);
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

export const createPaymentRequirements = (config: MiddlewareConfig): PaymentRequirements => {
  const networkName = toSlug(config.network);
  const network = getNetworkConfig(networkName);
  if (!network) throw new Error(`Unsupported network: ${networkName}`);

  const requirements: PaymentRequirementsV2 = {
    scheme: "exact",
    network: toEip155(config.network) as `eip155:${string}`,
    maxAmountRequired: config.amount,
    asset: network.usdcAddress as `0x${string}`,
    payTo: config.payTo as PayToV2,
    maxTimeoutSeconds: 300,
  };

  return requirements;
};
