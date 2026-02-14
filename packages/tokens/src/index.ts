import type { CustomToken } from "@armory-sh/base";

export type TokenConfig = CustomToken;

const tokenRegistry = new Map<string, TokenConfig>();
const tokenKey = (chainId: number, contractAddress: string): string =>
  `${chainId}:${contractAddress.toLowerCase()}`;

export const USDC_BASE: TokenConfig = {
  symbol: "USDC",
  name: "USD Coin",
  version: "2",
  contractAddress: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  chainId: 8453,
  decimals: 6,
};

export const USDC_BASE_SEPOLIA: TokenConfig = {
  symbol: "USDC",
  name: "USD Coin",
  version: "2",
  contractAddress: "0x036C0372124Afb96038AEeCb8460bDDfbaDf891f18",
  chainId: 84532,
  decimals: 6,
};

// ============ EURC Token ============

export const EURC_BASE: TokenConfig = {
  symbol: "EURC",
  name: "EURC",
  version: "2",
  contractAddress: "0x60a3E35Cc302bFA44Cb288Bc5a4F316Fdb1adb42",
  chainId: 8453,
  decimals: 6,
};

// ============ SKALE Base Mainnet Tokens ============
// https://docs.skale.space/get-started/quick-start/skale-on-base
// Chain ID: 1187947933 | RPC: https://skale-base.skalenodes.com/v1/base

export const USDC_SKALE_BASE: TokenConfig = {
  symbol: "USDC",
  name: "USD Coin",
  version: "2",
  contractAddress: "0x85889c8c714505E0c94b30fcfcF64fE3Ac8FCb20",
  chainId: 1187947933,
  decimals: 6,
};

export const USDT_SKALE_BASE: TokenConfig = {
  symbol: "USDT",
  name: "Tether USD",
  version: "1",
  contractAddress: "0x2bF5bF154b515EaA82C31a65ec11554fF5aF7fCA",
  chainId: 1187947933,
  decimals: 6,
};

export const WBTC_SKALE_BASE: TokenConfig = {
  symbol: "WBTC",
  name: "Wrapped BTC",
  version: "1",
  contractAddress: "0x1aeeCFE5454c83B42D8A316246CAc9739E7f690e",
  chainId: 1187947933,
  decimals: 8,
};

export const WETH_SKALE_BASE: TokenConfig = {
  symbol: "WETH",
  name: "Wrapped Ether",
  version: "1",
  contractAddress: "0x7bD39ABBd0Dd13103542cAe3276C7fA332bCA486",
  chainId: 1187947933,
  decimals: 6,
};

// ============ SKALE Base Sepolia Testnet Tokens ============
// https://docs.skale.space/get-started/quick-start/skale-on-base
// Chain ID: 324705682 | RPC: https://base-sepolia-testnet.skalenodes.com/v1/jubilant-horrible-ancha

export const SKL_SKALE_BASE_SEPOLIA: TokenConfig = {
  symbol: "SKL",
  name: "SKALE",
  version: "1",
  contractAddress: "0xaf2e0ff5b5f51553fdb34ce7f04a6c3201cee57b",
  chainId: 324705682,
  decimals: 18,
};

export const USDC_SKALE_BASE_SEPOLIA: TokenConfig = {
  symbol: "USDC",
  name: "USD Coin",
  version: "2",
  contractAddress: "0x2e08028E3C4c2356572E096d8EF835cD5C6030bD",
  chainId: 324705682,
  decimals: 6,
};

export const USDT_SKALE_BASE_SEPOLIA: TokenConfig = {
  symbol: "USDT",
  name: "Tether USD",
  version: "1",
  contractAddress: "0x3ca0a49f511c2c89c4dcbbf1731120d8919050bf",
  chainId: 324705682,
  decimals: 6,
};

export const WBTC_SKALE_BASE_SEPOLIA: TokenConfig = {
  symbol: "WBTC",
  name: "Wrapped BTC",
  version: "1",
  contractAddress: "0x4512eacd4186b025186e1cf6cc0d89497c530e87",
  chainId: 324705682,
  decimals: 8,
};

export const WETH_SKALE_BASE_SEPOLIA: TokenConfig = {
  symbol: "WETH",
  name: "Wrapped Ether",
  version: "1",
  contractAddress: "0xf94056bd7f6965db3757e1b145f200b7346b4fc0",
  chainId: 324705682,
  decimals: 6,
};

// ============ Registry Functions ============

// Register all tokens
const registerToken = (token: TokenConfig): TokenConfig => {
  tokenRegistry.set(tokenKey(token.chainId, token.contractAddress), token);
  return token;
};

export const getToken = (
  chainId: number,
  contractAddress: string
): TokenConfig | undefined => tokenRegistry.get(tokenKey(chainId, contractAddress));

export const getAllTokens = (): TokenConfig[] => Array.from(tokenRegistry.values());

export const getTokensBySymbol = (symbol: string): TokenConfig[] =>
  Array.from(tokenRegistry.values()).filter((t) => t.symbol === symbol);

export const getTokensByChain = (chainId: number): TokenConfig[] =>
  Array.from(tokenRegistry.values()).filter((t) => t.chainId === chainId);

export const getUSDCTokens = (): TokenConfig[] => getTokensBySymbol("USDC");

export const getEURCTokens = (): TokenConfig[] => getTokensBySymbol("EURC");

export const getSKLTokens = (): TokenConfig[] => getTokensBySymbol("SKL");

export const getUSDTTokens = (): TokenConfig[] => getTokensBySymbol("USDT");

export const getWBTCTokens = (): TokenConfig[] => getTokensBySymbol("WBTC");

export const getWETHTokens = (): TokenConfig[] => getTokensBySymbol("WETH");

// Token collections
export const TOKENS = {
  // Base
  USDC_BASE,
  USDC_BASE_SEPOLIA,
  EURC_BASE,
  // SKALE Base Mainnet
  USDC_SKALE_BASE,
  USDT_SKALE_BASE,
  WBTC_SKALE_BASE,
  WETH_SKALE_BASE,
  // SKALE Base Sepolia Testnet
  SKL_SKALE_BASE_SEPOLIA,
  USDC_SKALE_BASE_SEPOLIA,
  USDT_SKALE_BASE_SEPOLIA,
  WBTC_SKALE_BASE_SEPOLIA,
  WETH_SKALE_BASE_SEPOLIA,
} as const;

// Initialize registry
Object.values(TOKENS).forEach(registerToken);

// Re-export types
export type { CustomToken };
