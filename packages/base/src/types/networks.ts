const isEvmAddress = (value: string): boolean =>
  /^0x[a-fA-F0-9]{40}$/.test(value);

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

const tokenKey = (chainId: number, contractAddress: string): string =>
  `${chainId}:${contractAddress.toLowerCase()}`;

// Built-in tokens - hardcoded in registry
const tokenRegistry = new Map<string, CustomToken>([
  [tokenKey(8453, "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"), {
    symbol: "USDC",
    name: "USDC",
    version: "2",
    contractAddress: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as `0x${string}`,
    chainId: 8453,
    decimals: 6,
  }],
  [tokenKey(84532, "0x036CbD53842c5426634e7929541eC2318f3dCF7e"), {
    symbol: "USDC",
    name: "USDC",
    version: "2",
    contractAddress: "0x036CbD53842c5426634e7929541eC2318f3dCF7e" as `0x${string}`,
    chainId: 84532,
    decimals: 6,
  }],
  [tokenKey(8453, "0x60a3E35Cc302bFA44Cb288Bc5a4F316Fdb1adb42"), {
    symbol: "EURC",
    name: "EURC",
    version: "2",
    contractAddress: "0x60a3E35Cc302bFA44Cb288Bc5a4F316Fdb1adb42" as `0x${string}`,
    chainId: 8453,
    decimals: 6,
  }],
  [tokenKey(1187947933, "0x85889c8c714505E0c94b30fcfcF64fE3Ac8FCb20"), {
    symbol: "USDC",
    name: "USDC",
    version: "2",
    contractAddress: "0x85889c8c714505E0c94b30fcfcF64fE3Ac8FCb20" as `0x${string}`,
    chainId: 1187947933,
    decimals: 6,
  }],
  [tokenKey(1187947933, "0x2bF5bF154b515EaA82C31a65ec11554fF5aF7fCA"), {
    symbol: "USDT",
    name: "USDT",
    version: "1",
    contractAddress: "0x2bF5bF154b515EaA82C31a65ec11554fF5aF7fCA" as `0x${string}`,
    chainId: 1187947933,
    decimals: 6,
  }],
  [tokenKey(1187947933, "0x1aeeCFE5454c83B42D8A316246CAc9739E7f690e"), {
    symbol: "WBTC",
    name: "Wrapped BTC",
    version: "1",
    contractAddress: "0x1aeeCFE5454c83B42D8A316246CAc9739E7f690e" as `0x${string}`,
    chainId: 1187947933,
    decimals: 8,
  }],
  [tokenKey(1187947933, "0x7bD39ABBd0Dd13103542cAe3276C7fA332bCA486"), {
    symbol: "WETH",
    name: "Wrapped Ether",
    version: "1",
    contractAddress: "0x7bD39ABBd0Dd13103542cAe3276C7fA332bCA486" as `0x${string}`,
    chainId: 1187947933,
    decimals: 6,
  }],
  [tokenKey(324705682, "0xaf2e0ff5b5f51553fdb34ce7f04a6c3201cee57b"), {
    symbol: "SKL",
    name: "SKALE",
    version: "1",
    contractAddress: "0xaf2e0ff5b5f51553fdb34ce7f04a6c3201cee57b" as `0x${string}`,
    chainId: 324705682,
    decimals: 18,
  }],
  [tokenKey(324705682, "0x036CbD53842c5426634e7929541eC2318f3dCF7e"), {
    symbol: "USDC",
    name: "USDC",
    version: "2",
    contractAddress: "0x036CbD53842c5426634e7929541eC2318f3dCF7e" as `0x${string}`,
    chainId: 324705682,
    decimals: 6,
  }],
  [tokenKey(324705682, "0x3ca0a49f511c2c89c4dcbbf1731120d8919050bf"), {
    symbol: "USDT",
    name: "USDT",
    version: "1",
    contractAddress: "0x3ca0a49f511c2c89c4dcbbf1731120d8919050bf" as `0x${string}`,
    chainId: 324705682,
    decimals: 6,
  }],
  [tokenKey(324705682, "0x4512eacd4186b025186e1cf6cc0d89497c530e87"), {
    symbol: "WBTC",
    name: "Wrapped BTC",
    version: "1",
    contractAddress: "0x4512eacd4186b025186e1cf6cc0d89497c530e87" as `0x${string}`,
    chainId: 324705682,
    decimals: 8,
  }],
  [tokenKey(324705682, "0xf94056bd7f6965db3757e1b145f200b7346b4fc0"), {
    symbol: "WETH",
    name: "Wrapped Ether",
    version: "1",
    contractAddress: "0xf94056bd7f6965db3757e1b145f200b7346b4fc0" as `0x${string}`,
    chainId: 324705682,
    decimals: 18,
  }],
]);

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
    usdcAddress: "0x036CbD53842c5426634e7929541eC2318f3dCF7e" as const,
    rpcUrl: "https://sepolia.base.org",
    caip2Id: "eip155:84532",
    caipAssetId:
      "eip155:84532/erc20:0x036CbD53842c5426634e7929541eC2318f3dCF7e",
  },
  "skale-base": {
    name: "SKALE Base",
    chainId: 1187947933,
    usdcAddress: "0x85889c8c714505E0c94b30fcfcF64fE3Ac8FCb20" as const,
    rpcUrl: "https://skale-base.skalenodes.com/v1/base",
    caip2Id: "eip155:1187947933",
    caipAssetId:
      "eip155:1187947933/erc20:0x85889c8c714505E0c94b30fcfcF64fE3Ac8FCb20",
  },
  "skale-base-sepolia": {
    name: "SKALE Base Sepolia",
    chainId: 324705682,
    usdcAddress: "0x2e08028E3C4c2356572E096d8EF835cD5C6030bD" as const,
    rpcUrl:
      "https://base-sepolia-testnet.skalenodes.com/v1/jubilant-horrible-ancha",
    caip2Id: "eip155:324705682",
    caipAssetId:
      "eip155:324705682/erc20:0x2e08028E3C4c2356572E096d8EF835cD5C6030bD",
  },
  "ethereum-sepolia": {
    name: "Ethereum Sepolia",
    chainId: 11155111,
    usdcAddress: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238" as const,
    rpcUrl: "https://rpc.sepolia.org",
    caip2Id: "eip155:11155111",
    caipAssetId:
      "eip155:11155111/erc20:0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238",
  },
};

export const getNetworkConfig = (name: string): NetworkConfig | undefined =>
  NETWORKS[name];
export const getNetworkByChainId = (
  chainId: number,
): NetworkConfig | undefined =>
  Object.values(NETWORKS).find((c) => c.chainId === chainId);
export const getMainnets = (): NetworkConfig[] =>
  Object.values(NETWORKS).filter(
    (c) => !c.name.toLowerCase().includes("sepolia"),
  );
export const getTestnets = (): NetworkConfig[] =>
  Object.values(NETWORKS).filter((c) =>
    c.name.toLowerCase().includes("sepolia"),
  );

export const registerToken = (token: unknown): CustomToken => {
  if (typeof token !== "object" || token === null) {
    throw new Error("Invalid token: must be an object");
  }

  const t = token as Record<string, unknown>;

  if (typeof t.symbol !== "string") {
    throw new Error("Invalid token: symbol must be a string");
  }

  if (typeof t.name !== "string") {
    throw new Error("Invalid token: name must be a string");
  }

  if (typeof t.version !== "string") {
    throw new Error("Invalid token: version must be a string");
  }

  if (
    typeof t.contractAddress !== "string" ||
    !isEvmAddress(t.contractAddress)
  ) {
    throw new Error(
      "Invalid token: contractAddress must be a valid EVM address",
    );
  }

  if (
    typeof t.chainId !== "number" ||
    !Number.isInteger(t.chainId) ||
    t.chainId <= 0
  ) {
    throw new Error("Invalid token: chainId must be a positive integer");
  }

  if (
    t.decimals !== undefined &&
    (typeof t.decimals !== "number" ||
      !Number.isInteger(t.decimals) ||
      t.decimals < 0)
  ) {
    throw new Error("Invalid token: decimals must be a non-negative integer");
  }

  const validated: CustomToken = {
    symbol: t.symbol,
    name: t.name,
    version: t.version,
    contractAddress: t.contractAddress as `0x${string}`,
    chainId: t.chainId,
    decimals: t.decimals,
  };

  tokenRegistry.set(
    tokenKey(validated.chainId, validated.contractAddress),
    validated,
  );
  return validated;
};

export const getCustomToken = (
  chainId: number,
  contractAddress: string,
): CustomToken | undefined =>
  tokenRegistry.get(tokenKey(chainId, contractAddress));

export const getAllCustomTokens = (): CustomToken[] =>
  Array.from(tokenRegistry.values());

export const unregisterToken = (
  chainId: number,
  contractAddress: string,
): boolean => tokenRegistry.delete(tokenKey(chainId, contractAddress));

export const isCustomToken = (
  chainId: number,
  contractAddress: string,
): boolean => tokenRegistry.has(tokenKey(chainId, contractAddress));
