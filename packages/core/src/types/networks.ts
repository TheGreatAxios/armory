import { type as arkType } from "arktype";
import { CustomTokenSchema } from "../validation";

export interface NetworkConfig {
  name: string;
  chainId: number;
  usdcAddress: `0x${string}`;
  rpcUrl: string;
  caip2Id: string;
  caipAssetId: string;
}

export interface CustomToken {
  symbol: string;
  name: string;
  version: string;
  contractAddress: `0x${string}`;
  chainId: number;
  decimals?: number;
}

const tokenRegistry = new Map<string, CustomToken>();
const tokenKey = (chainId: number, contractAddress: string): string =>
  `${chainId}:${contractAddress.toLowerCase()}`;

export const NETWORKS: Record<string, NetworkConfig> = {
  ethereum: {
    name: "Ethereum Mainnet",
    chainId: 1,
    usdcAddress: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48" as const,
    rpcUrl: "https://eth.llamarpc.com",
    caip2Id: "eip155:1",
    caipAssetId: "eip155:1/erc20:0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
  },
  base: {
    name: "Base Mainnet",
    chainId: 8453,
    usdcAddress: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as const,
    rpcUrl: "https://mainnet.base.org",
    caip2Id: "eip155:8453",
    caipAssetId: "eip155:8453/erc20:0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  },
  "base-sepolia": {
    name: "Base Sepolia",
    chainId: 84532,
    usdcAddress: "0x036CbD53842c5426634e7929541eA237834d2D14" as const,
    rpcUrl: "https://sepolia.base.org",
    caip2Id: "eip155:84532",
    caipAssetId: "eip155:84532/erc20:0x036CbD53842c5426634e7929541eA237834d2D14",
  },
  "skale-base": {
    name: "SKALE Base",
    chainId: 1187947933,
    usdcAddress: "0x85889c8c714505E0c94b30fcfcF64fE3Ac8FCb20" as const,
    rpcUrl: "https://skale-base.skalenodes.com/v1/base",
    caip2Id: "eip155:1187947933",
    caipAssetId: "eip155:1187947933/erc20:0x85889c8c714505E0c94b30fcfcF64fE3Ac8FCb20",
  },
  "skale-base-sepolia": {
    name: "SKALE Base Sepolia",
    chainId: 324705682,
    usdcAddress: "0x2e08028E3C4c2356572E096d8EF835cD5C6030bD" as const,
    rpcUrl: "https://base-sepolia-testnet.skalenodes.com/v1/jubilant-horrible-ancha",
    caip2Id: "eip155:324705682",
    caipAssetId: "eip155:324705682/erc20:0x2e08028E3C4c2356572E096d8EF835cD5C6030bD",
  },
  "ethereum-sepolia": {
    name: "Ethereum Sepolia",
    chainId: 11155111,
    usdcAddress: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238" as const,
    rpcUrl: "https://rpc.sepolia.org",
    caip2Id: "eip155:11155111",
    caipAssetId: "eip155:11155111/erc20:0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238",
  },
};

export const getNetworkConfig = (name: string): NetworkConfig | undefined => NETWORKS[name];
export const getNetworkByChainId = (chainId: number): NetworkConfig | undefined =>
  Object.values(NETWORKS).find((c) => c.chainId === chainId);
export const getMainnets = (): NetworkConfig[] =>
  Object.values(NETWORKS).filter((c) => !c.name.toLowerCase().includes("sepolia"));
export const getTestnets = (): NetworkConfig[] =>
  Object.values(NETWORKS).filter((c) => c.name.toLowerCase().includes("sepolia"));

export const registerToken = (token: unknown): CustomToken => {
  const validated = CustomTokenSchema(token);
  if (validated instanceof arkType.errors) {
    throw new Error(`Invalid token: ${validated.summary}`);
  }
  tokenRegistry.set(tokenKey(validated.chainId, validated.contractAddress), validated);
  return validated;
};

export const getCustomToken = (
  chainId: number,
  contractAddress: string
): CustomToken | undefined => tokenRegistry.get(tokenKey(chainId, contractAddress));

export const getAllCustomTokens = (): CustomToken[] => Array.from(tokenRegistry.values());

export const unregisterToken = (chainId: number, contractAddress: string): boolean =>
  tokenRegistry.delete(tokenKey(chainId, contractAddress));

export const isCustomToken = (chainId: number, contractAddress: string): boolean =>
  tokenRegistry.has(tokenKey(chainId, contractAddress));
