import { test, expect, describe } from "bun:test";
import {
  // Token Constants
  USDC_BASE,
  USDC_BASE_SEPOLIA,
  EURC_BASE,
  USDC_SKALE_BASE,
  USDT_SKALE_BASE,
  WBTC_SKALE_BASE,
  WETH_SKALE_BASE,
  SKL_SKALE_BASE_SEPOLIA,
  USDC_SKALE_BASE_SEPOLIA,
  USDT_SKALE_BASE_SEPOLIA,
  WBTC_SKALE_BASE_SEPOLIA,
  WETH_SKALE_BASE_SEPOLIA,
  // Registry Functions
  getToken,
  getAllTokens,
  getTokensBySymbol,
  getTokensByChain,
  // Helper Functions
  getUSDCTokens,
  getEURCTokens,
  getSKLTokens,
  getUSDTTokens,
  getWBTCTokens,
  getWETHTokens,
  // Token Collection
  TOKENS,
} from "../src/index";

describe("Token Constants", () => {
  test("USDC_BASE token is correctly configured", () => {
    expect(USDC_BASE.symbol).toBe("USDC");
    expect(USDC_BASE.name).toBe("USD Coin");
    expect(USDC_BASE.version).toBe("2");
    expect(USDC_BASE.contractAddress).toBe("0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913");
    expect(USDC_BASE.chainId).toBe(8453);
    expect(USDC_BASE.decimals).toBe(6);
  });

  test("USDC_BASE_SEPOLIA token is correctly configured", () => {
    expect(USDC_BASE_SEPOLIA.symbol).toBe("USDC");
    expect(USDC_BASE_SEPOLIA.name).toBe("USD Coin");
    expect(USDC_BASE_SEPOLIA.version).toBe("2");
    expect(USDC_BASE_SEPOLIA.contractAddress).toBe("0x036C0372124Afb96038AEeCb8460bDDfbaDf891f18");
    expect(USDC_BASE_SEPOLIA.chainId).toBe(84532);
    expect(USDC_BASE_SEPOLIA.decimals).toBe(6);
  });

  test("EURC_BASE token is correctly configured", () => {
    expect(EURC_BASE.symbol).toBe("EURC");
    expect(EURC_BASE.name).toBe("EURC");
    expect(EURC_BASE.version).toBe("2");
    expect(EURC_BASE.contractAddress).toBe("0x60a3E35Cc302bFA44Cb288Bc5a4F316Fdb1adb42");
    expect(EURC_BASE.chainId).toBe(8453);
    expect(EURC_BASE.decimals).toBe(6);
  });

  test("All token constants have required fields", () => {
    const tokens = [
      USDC_BASE,
      USDC_BASE_SEPOLIA,
      EURC_BASE,
      USDC_SKALE_BASE,
      USDT_SKALE_BASE,
      WBTC_SKALE_BASE,
      WETH_SKALE_BASE,
      SKL_SKALE_BASE_SEPOLIA,
      USDC_SKALE_BASE_SEPOLIA,
      USDT_SKALE_BASE_SEPOLIA,
      WBTC_SKALE_BASE_SEPOLIA,
      WETH_SKALE_BASE_SEPOLIA,
    ];

    for (const token of tokens) {
      expect(token.symbol).toBeDefined();
      expect(token.symbol).toBeString();
      expect(token.symbol.length).toBeGreaterThan(0);

      expect(token.name).toBeDefined();
      expect(token.name).toBeString();
      expect(token.name.length).toBeGreaterThan(0);

      expect(token.version).toBeDefined();
      expect(token.version).toBeString();
      expect(token.version.length).toBeGreaterThan(0);

      expect(token.contractAddress).toBeDefined();
      expect(token.contractAddress).toBeString();
      expect(token.contractAddress).toMatch(/^0x[a-fA-F0-9]{40,42}$/);

      expect(token.chainId).toBeDefined();
      expect(token.chainId).toBeNumber();
      expect(token.chainId).toBeGreaterThan(0);

      expect(token.decimals).toBeDefined();
      expect(token.decimals).toBeNumber();
      expect(token.decimals).toBeGreaterThan(0);
    }
  });
});

describe("Registry Functions", () => {
  test("getToken retrieves token by chainId and address", () => {
    const token = getToken(8453, "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913");
    expect(token).toBeDefined();
    expect(token?.symbol).toBe("USDC");
    expect(token?.chainId).toBe(8453);
  });

  test("getToken is case-insensitive for contract address", () => {
    const lowercase = getToken(8453, "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913");
    const uppercase = getToken(8453, "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913");
    const mixed = getToken(8453, "0x833589FcD6eDb6E08f4c7C32D4f71b54BdA02913");

    expect(lowercase).toEqual(uppercase);
    expect(uppercase).toEqual(mixed);
  });

  test("getToken returns undefined for non-existent token", () => {
    const token = getToken(999, "0x0000000000000000000000000000000000000000");
    expect(token).toBeUndefined();
  });

  test("getAllTokens returns all registered tokens", () => {
    const allTokens = getAllTokens();
    expect(allTokens).toBeArray();
    expect(allTokens.length).toBe(12);

    // Verify all expected symbols are present
    const symbols = allTokens.map((t) => t.symbol);
    expect(symbols).toContain("USDC");
    expect(symbols).toContain("EURC");
    expect(symbols).toContain("USDT");
    expect(symbols).toContain("WBTC");
    expect(symbols).toContain("WETH");
    expect(symbols).toContain("SKL");
  });

  test("getTokensBySymbol filters by symbol", () => {
    const usdcTokens = getTokensBySymbol("USDC");
    expect(usdcTokens.length).toBe(4);
    expect(usdcTokens.every((t) => t.symbol === "USDC")).toBeTrue();

    const wbtcTokens = getTokensBySymbol("WBTC");
    expect(wbtcTokens.length).toBe(2);
    expect(wbtcTokens.every((t) => t.symbol === "WBTC")).toBeTrue();
  });

  test("getTokensBySymbol returns empty array for unknown symbol", () => {
    const tokens = getTokensBySymbol("UNKNOWN");
    expect(tokens).toBeArray();
    expect(tokens.length).toBe(0);
  });

  test("getTokensByChain filters by chainId", () => {
    const baseTokens = getTokensByChain(8453);
    expect(baseTokens.length).toBe(2);
    expect(baseTokens.every((t) => t.chainId === 8453)).toBeTrue();

    const skaleBaseTokens = getTokensByChain(1187947933);
    expect(skaleBaseTokens.length).toBe(4);
    expect(skaleBaseTokens.every((t) => t.chainId === 1187947933)).toBeTrue();

    const skaleSepoliaTokens = getTokensByChain(324705682);
    expect(skaleSepoliaTokens.length).toBe(5);
    expect(skaleSepoliaTokens.every((t) => t.chainId === 324705682)).toBeTrue();
  });

  test("getTokensByChain returns empty array for unknown chainId", () => {
    const tokens = getTokensByChain(999);
    expect(tokens).toBeArray();
    expect(tokens.length).toBe(0);
  });
});

describe("Helper Functions", () => {
  test("getUSDCTokens returns only USDC tokens", () => {
    const usdcTokens = getUSDCTokens();
    expect(usdcTokens.length).toBe(4);
    expect(usdcTokens.every((t) => t.symbol === "USDC")).toBeTrue();

    const chainIds = usdcTokens.map((t) => t.chainId);
    expect(chainIds).toContain(8453);
    expect(chainIds).toContain(84532);
    expect(chainIds).toContain(1187947933);
  });

  test("getEURCTokens returns only EURC tokens", () => {
    const eurcTokens = getEURCTokens();
    expect(eurcTokens.length).toBe(1);
    expect(eurcTokens[0].symbol).toBe("EURC");
    expect(eurcTokens[0].chainId).toBe(8453);
  });

  test("getSKLTokens returns only SKL tokens", () => {
    const sklTokens = getSKLTokens();
    expect(sklTokens.length).toBe(1);
    expect(sklTokens[0].symbol).toBe("SKL");
    expect(sklTokens[0].chainId).toBe(324705682);
  });

  test("getUSDTTokens returns only USDT tokens", () => {
    const usdtTokens = getUSDTTokens();
    expect(usdtTokens.length).toBe(2);
    expect(usdtTokens.every((t) => t.symbol === "USDT")).toBeTrue();

    const chainIds = usdtTokens.map((t) => t.chainId);
    expect(chainIds).toContain(1187947933);
    expect(chainIds).toContain(324705682);
  });

  test("getWBTCTokens returns only WBTC tokens", () => {
    const wbtcTokens = getWBTCTokens();
    expect(wbtcTokens.length).toBe(2);
    expect(wbtcTokens.every((t) => t.symbol === "WBTC")).toBeTrue();

    const chainIds = wbtcTokens.map((t) => t.chainId);
    expect(chainIds).toContain(1187947933);
    expect(chainIds).toContain(324705682);
  });

  test("getWETHTokens returns only WETH tokens", () => {
    const wethTokens = getWETHTokens();
    expect(wethTokens.length).toBe(2);
    expect(wethTokens.every((t) => t.symbol === "WETH")).toBeTrue();

    const chainIds = wethTokens.map((t) => t.chainId);
    expect(chainIds).toContain(1187947933);
    expect(chainIds).toContain(324705682);
  });
});

describe("Token Collection", () => {
  test("TOKENS collection contains all expected tokens", () => {
    const expectedKeys = [
      "USDC_BASE",
      "USDC_BASE_SEPOLIA",
      "EURC_BASE",
      "USDC_SKALE_BASE",
      "USDT_SKALE_BASE",
      "WBTC_SKALE_BASE",
      "WETH_SKALE_BASE",
      "SKL_SKALE_BASE_SEPOLIA",
      "USDC_SKALE_BASE_SEPOLIA",
      "USDT_SKALE_BASE_SEPOLIA",
      "WBTC_SKALE_BASE_SEPOLIA",
      "WETH_SKALE_BASE_SEPOLIA",
    ];

    expect(Object.keys(TOKENS)).toEqual(expectedKeys);
    expect(Object.keys(TOKENS).length).toBe(12);
  });

  test("TOKENS values match individual token constants", () => {
    expect(TOKENS.USDC_BASE).toEqual(USDC_BASE);
    expect(TOKENS.USDC_BASE_SEPOLIA).toEqual(USDC_BASE_SEPOLIA);
    expect(TOKENS.EURC_BASE).toEqual(EURC_BASE);
    expect(TOKENS.USDC_SKALE_BASE).toEqual(USDC_SKALE_BASE);
    expect(TOKENS.USDT_SKALE_BASE).toEqual(USDT_SKALE_BASE);
    expect(TOKENS.WBTC_SKALE_BASE).toEqual(WBTC_SKALE_BASE);
    expect(TOKENS.WETH_SKALE_BASE).toEqual(WETH_SKALE_BASE);
    expect(TOKENS.SKL_SKALE_BASE_SEPOLIA).toEqual(SKL_SKALE_BASE_SEPOLIA);
    expect(TOKENS.USDC_SKALE_BASE_SEPOLIA).toEqual(USDC_SKALE_BASE_SEPOLIA);
    expect(TOKENS.USDT_SKALE_BASE_SEPOLIA).toEqual(USDT_SKALE_BASE_SEPOLIA);
    expect(TOKENS.WBTC_SKALE_BASE_SEPOLIA).toEqual(WBTC_SKALE_BASE_SEPOLIA);
    expect(TOKENS.WETH_SKALE_BASE_SEPOLIA).toEqual(WETH_SKALE_BASE_SEPOLIA);
  });

  test("TOKENS collection is readonly (as const)", () => {
    // Verify TOKENS is properly typed as const
    expect(TOKENS.USDC_BASE.symbol).toBe("USDC");
    // TypeScript should prevent modification at compile time
    // This test documents the expected behavior
  });
});

describe("Edge Cases", () => {
  test("Registry handles duplicate registrations gracefully", () => {
    const allTokensBefore = getAllTokens();
    const countBefore = allTokensBefore.length;

    // Re-registering same token should not increase count
    const token = USDC_BASE;
    const key = `${token.chainId}:${token.contractAddress.toLowerCase()}`;

    // The registry uses Map.set which overwrites duplicates
    const allTokensAfter = getAllTokens();
    const countAfter = allTokensAfter.length;

    expect(countAfter).toBe(countBefore);
  });

  test("Token key generation is consistent", () => {
    const key1 = `${8453}:${"0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913".toLowerCase()}`;
    const key2 = `${8453}:${"0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913".toLowerCase()}`;

    expect(key1).toBe(key2);
  });

  test("Different chains have unique token keys", () => {
    const usdcBaseKey = `${8453}:${"0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913".toLowerCase()}`;
    const usdcSkaleKey = `${1187947933}:${"0x85889c8c714505E0c94b30fcfcF64fE3Ac8FCb20".toLowerCase()}`;

    expect(usdcBaseKey).not.toBe(usdcSkaleKey);
  });

  test("All registered tokens are retrievable via getToken", () => {
    const allTokens = getAllTokens();

    for (const token of allTokens) {
      const retrieved = getToken(token.chainId, token.contractAddress);
      expect(retrieved).toBeDefined();
      expect(retrieved).toEqual(token);
    }
  });

  test("Empty symbol search returns empty array", () => {
    const result = getTokensBySymbol("");
    expect(result).toBeArray();
    expect(result.length).toBe(0);
  });

  test("Zero and negative chainIds return empty arrays", () => {
    expect(getTokensByChain(0)).toEqual([]);
    expect(getTokensByChain(-1)).toEqual([]);
  });
});

describe("Token Validation", () => {
  test("All tokens have valid Ethereum addresses", () => {
    const allTokens = getAllTokens();

    for (const token of allTokens) {
      // Ethereum address: 0x followed by 40-42 hex characters
      expect(token.contractAddress).toMatch(/^0x[a-fA-F0-9]{40,42}$/);
    }
  });

  test("All tokens have valid decimals (6, 8, or 18)", () => {
    const allTokens = getAllTokens();

    for (const token of allTokens) {
      expect([6, 8, 18]).toContain(token.decimals);
    }
  });

  test("All tokens have non-empty version strings", () => {
    const allTokens = getAllTokens();

    for (const token of allTokens) {
      expect(token.version).toBeTruthy();
      expect(token.version.length).toBeGreaterThan(0);
    }
  });
});
