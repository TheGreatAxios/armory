import type { CustomToken } from "../types/networks";

export const USDC_BASE: CustomToken = {
  symbol: "USDC",
  name: "USD Coin",
  version: "2",
  contractAddress: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as `0x${string}`,
  chainId: 8453,
  decimals: 6,
};

export const EURC_BASE: CustomToken = {
  symbol: "EURC",
  name: "EURC",
  version: "2",
  contractAddress: "0x60a3E35Cc302bFA44Cb288Bc5a4F316Fdb1adb42" as `0x${string}`,
  chainId: 8453,
  decimals: 6,
};

export const USDC_BASE_SEPOLIA: CustomToken = {
  symbol: "USDC",
  name: "USD Coin",
  version: "2",
  contractAddress: "0x036CbD53842c5426634e7929541eC2318f3dCF7e" as `0x${string}`,
  chainId: 84532,
  decimals: 6,
};

export const USDC_SKALE_BASE: CustomToken = {
  symbol: "USDC",
  name: "USD Coin",
  version: "2",
  contractAddress: "0x85889c8c714505E0c94b30fcfcF64fE3Ac8FCb20" as `0x${string}`,
  chainId: 1187947933,
  decimals: 6,
};

export const SKL_SKALE_BASE: CustomToken = {
  symbol: "SKL",
  name: "SKALE",
  version: "1",
  contractAddress: "0xE0595a049d02b7674572b0d59cd4880Db60EDC50" as `0x${string}`,
  chainId: 1187947933,
  decimals: 18,
};

export const USDT_SKALE_BASE: CustomToken = {
  symbol: "USDT",
  name: "Tether USD",
  version: "1",
  contractAddress: "0x2bF5bF154b515EaA82C31a65ec11554fF5aF7fCA" as `0x${string}`,
  chainId: 1187947933,
  decimals: 6,
};

export const WBTC_SKALE_BASE: CustomToken = {
  symbol: "WBTC",
  name: "Wrapped BTC",
  version: "1",
  contractAddress: "0x1aeeCFE5454c83B42D8A316246CAc9739E7f690e" as `0x${string}`,
  chainId: 1187947933,
  decimals: 8,
};

export const WETH_SKALE_BASE: CustomToken = {
  symbol: "WETH",
  name: "Wrapped Ether",
  version: "1",
  contractAddress: "0x7bD39ABBd0Dd13103542cAe3276C7fA332bCA486" as `0x${string}`,
  chainId: 1187947933,
  decimals: 18,
};

export const SKL_SKALE_BASE_SEPOLIA: CustomToken = {
  symbol: "SKL",
  name: "SKALE",
  version: "1",
  contractAddress: "0xaf2e0ff5b5f51553fdb34ce7f04a6c3201cee57b" as `0x${string}`,
  chainId: 324705682,
  decimals: 18,
};

export const USDC_SKALE_BASE_SEPOLIA: CustomToken = {
  symbol: "USDC",
  name: "USD Coin",
  version: "2",
  contractAddress: "0x2e08028E3C4c2356572E096d8EF835cD5C6030bD" as `0x${string}`,
  chainId: 324705682,
  decimals: 6,
};

export const USDT_SKALE_BASE_SEPOLIA: CustomToken = {
  symbol: "USDT",
  name: "Tether USD",
  version: "1",
  contractAddress: "0x3ca0a49f511c2c89c4dcbbf1731120d8919050bf" as `0x${string}`,
  chainId: 324705682,
  decimals: 6,
};

export const WBTC_SKALE_BASE_SEPOLIA: CustomToken = {
  symbol: "WBTC",
  name: "Wrapped BTC",
  version: "1",
  contractAddress: "0x4512eacd4186b025186e1cf6cc0d89497c530e87" as `0x${string}`,
  chainId: 324705682,
  decimals: 8,
};

export const WETH_SKALE_BASE_SEPOLIA: CustomToken = {
  symbol: "WETH",
  name: "Wrapped Ether",
  version: "1",
  contractAddress: "0xf94056bd7f6965db3757e1b145f200b7346b4fc0" as `0x${string}`,
  chainId: 324705682,
  decimals: 18,
};

export const TOKENS = {
  USDC_BASE,
  USDC_BASE_SEPOLIA,
  EURC_BASE,
  USDC_SKALE_BASE,
  USDT_SKALE_BASE,
  WBTC_SKALE_BASE,
  WETH_SKALE_BASE,
  SKL_SKALE_BASE,
  SKL_SKALE_BASE_SEPOLIA,
  USDC_SKALE_BASE_SEPOLIA,
  USDT_SKALE_BASE_SEPOLIA,
  WBTC_SKALE_BASE_SEPOLIA,
  WETH_SKALE_BASE_SEPOLIA,
} as const;

function getToken(chainId: number, contractAddress: string): CustomToken | undefined {
  const tokens = Object.values(TOKENS);
  return tokens.find(
    (t) => t.chainId === chainId && t.contractAddress.toLowerCase() === contractAddress.toLowerCase()
  );
}

function getAllTokens(): CustomToken[] {
  return Object.values(TOKENS);
}

function getTokensBySymbol(symbol: string): CustomToken[] {
  return getAllTokens().filter((t) => t.symbol.toUpperCase() === symbol.toUpperCase());
}

function getTokensByChain(chainId: number): CustomToken[] {
  return getAllTokens().filter((t) => t.chainId === chainId);
}

export function getUSDCTokens(): CustomToken[] {
  return getTokensBySymbol("USDC");
}

export function getEURCTokens(): CustomToken[] {
  return getTokensBySymbol("EURC");
}

export function getSKLTokens(): CustomToken[] {
  return getTokensBySymbol("SKL");
}

export function getUSDTTokens(): CustomToken[] {
  return getTokensBySymbol("USDT");
}

export function getWBTCTokens(): CustomToken[] {
  return getTokensBySymbol("WBTC");
}

export function getWETHTokens(): CustomToken[] {
  return getTokensBySymbol("WETH");
}

export { getToken, getAllTokens, getTokensBySymbol, getTokensByChain };
