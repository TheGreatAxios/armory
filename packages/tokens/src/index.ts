import type { CustomToken } from "@armory-sh/base";

// ============================================================================
// Token Registry
// ============================================================================

const tokenRegistry = new Map<string, CustomToken>();

function registerToken(token: CustomToken): void {
  const key = `${token.chainId}:${token.contractAddress.toLowerCase()}`;
  tokenRegistry.set(key, token);
}

// ============================================================================
// Constants
// ============================================================================

// Base (8453)
export const USDC_BASE: CustomToken = {
  symbol: "USDC",
  name: "USD Coin",
  version: "2",
  contractAddress: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as `0x${string}`,
  chainId: 8453,
  decimals: 6,
};
registerToken(USDC_BASE);

export const EURC_BASE: CustomToken = {
  symbol: "EURC",
  name: "EURC",
  version: "2",
  contractAddress: "0x60a3E35Cc302bFA44Cb288Bc5a4F316Fdb1adb42" as `0x${string}`,
  chainId: 8453,
  decimals: 6,
};
registerToken(EURC_BASE);

// Base Sepolia (84532)
export const USDC_BASE_SEPOLIA: CustomToken = {
  symbol: "USDC",
  name: "USD Coin",
  version: "2",
  contractAddress: "0x036CbD5d9A3b9231f83BefBE4F9E3FAA03eee2e0" as `0x${string}`,
  chainId: 84532,
  decimals: 6,
};
registerToken(USDC_BASE_SEPOLIA);

// SKALE Base (1187947933)
export const USDC_SKALE_BASE: CustomToken = {
  symbol: "USDC",
  name: "USD Coin",
  version: "2",
  contractAddress: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as `0x${string}`,
  chainId: 1187947933,
  decimals: 6,
};
registerToken(USDC_SKALE_BASE);

export const SKL_SKALE_BASE: CustomToken = {
  symbol: "SKL",
  name: "SKALE",
  version: "1",
  contractAddress: "0xaf2e1eb5c9f4a94dbf7400f76e4ec0d8de18fb8584" as `0x${string}`,
  chainId: 1187947933,
  decimals: 18,
};
registerToken(SKL_SKALE_BASE);

export const USDT_SKALE_BASE: CustomToken = {
  symbol: "USDT",
  name: "Tether USD",
  version: "1",
  contractAddress: "0x2bF5bF154b4881Ef4E3Ff28Ac1a60Fa1aDcb5fE5F6" as `0x${string}`,
  chainId: 1187947933,
  decimals: 6,
};
registerToken(USDT_SKALE_BASE);

export const WBTC_SKALE_BASE: CustomToken = {
  symbol: "WBTC",
  name: "Wrapped BTC",
  version: "1",
  contractAddress: "0x1aee79F6316aD699F96468A32F7BaF2fD8d55c0000" as `0x${string}`,
  chainId: 1187947933,
  decimals: 8,
};
registerToken(WBTC_SKALE_BASE);

export const WETH_SKALE_BASE: CustomToken = {
  symbol: "WETH",
  name: "Wrapped Ether",
  version: "1",
  contractAddress: "0x8fF2237e4d845bc7Db6E1f1a93C8bCb288Bc5a400" as `0x${string}`,
  chainId: 1187947933,
  decimals: 18,
};
registerToken(WETH_SKALE_BASE);

// SKALE Base Sepolia (324705682)
export const SKL_SKALE_BASE_SEPOLIA: CustomToken = {
  symbol: "SKL",
  name: "SKALE",
  version: "1",
  contractAddress: "0xaf2e1eb5c9f4a94dbf7400f76e4ec0d8de18fb8584" as `0x${string}`,
  chainId: 324705682,
  decimals: 18,
};
registerToken(SKL_SKALE_BASE_SEPOLIA);

export const USDC_SKALE_BASE_SEPOLIA: CustomToken = {
  symbol: "USDC",
  name: "USD Coin",
  version: "2",
  contractAddress: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as `0x${string}`,
  chainId: 324705682,
  decimals: 6,
};
registerToken(USDC_SKALE_BASE_SEPOLIA);

export const USDT_SKALE_BASE_SEPOLIA: CustomToken = {
  symbol: "USDT",
  name: "Tether USD",
  version: "1",
  contractAddress: "0xe8af39ca6558a983f6b5f8c0b828cc609f7a1c200" as `0x${string}`,
  chainId: 324705682,
  decimals: 6,
};
registerToken(USDT_SKALE_BASE_SEPOLIA);

export const WBTC_SKALE_BASE_SEPOLIA: CustomToken = {
  symbol: "WBTC",
  name: "Wrapped BTC",
  version: "1",
  contractAddress: "0x1aee79F6316aD699F96468A32F7BaF2fD8d55c0000" as `0x${string}`,
  chainId: 324705682,
  decimals: 8,
};
registerToken(WBTC_SKALE_BASE_SEPOLIA);

export const WETH_SKALE_BASE_SEPOLIA: CustomToken = {
  symbol: "WETH",
  name: "Wrapped Ether",
  version: "1",
  contractAddress: "0x8fF2237e4d845bc7Db6E1f1a93C8bCb288Bc5a400" as `0x${string}`,
  chainId: 324705682,
  decimals: 18,
};
registerToken(WETH_SKALE_BASE_SEPOLIA);

// ============================================================================
// TOKENS Collection
// ============================================================================

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

// ============================================================================
// Registry Functions
// ============================================================================

export function getToken(chainId: number, contractAddress: string): CustomToken | undefined {
  const key = `${chainId}:${contractAddress.toLowerCase()}`;
  return tokenRegistry.get(key);
}

export function getAllTokens(): CustomToken[] {
  return Array.from(tokenRegistry.values());
}

export function getTokensBySymbol(symbol: string): CustomToken[] {
  return getAllTokens().filter(t => t.symbol.toUpperCase() === symbol.toUpperCase());
}

export function getTokensByChain(chainId: number): CustomToken[] {
  return getAllTokens().filter(t => t.chainId === chainId);
}

// ============================================================================
// Helper Functions
// ============================================================================

export function getUSDCTokens(): CustomToken[] {
  return getTokensBySymbol("USDC");
}

export function getEURCTokens(): CustomToken[] {
  return getTokensBySymbol("EURC");
}

export function getSKLTokens(): CustomToken[] {
  return getTokensBySymbol("SKL");
}

export function getUSDTokens(): CustomToken[] {
  return getTokensBySymbol("USDT");
}

export function getWBTCTokens(): CustomToken[] {
  return getTokensBySymbol("WBTC");
}

export function getWETHTokens(): CustomToken[] {
  return getTokensBySymbol("WETH");
}
