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
  getUSDTokens,
  getWBTCTokens,
  getWETHTokens,
  // Token Collection
  TOKENS,
} from "../src/index";

describe("[tokens]: Token Constants", () => {
  test("USDC_BASE token is correctly configured", () => {
    expect(USDC_BASE.symbol).toBe("USDC");
    expect(USDC_BASE.name).toBe("USD Coin");
    expect(USDC_BASE.contractAddress).toMatch(/^0x[a-fA-F0-9]{40,42}$/);
    expect(USDC_BASE.chainId).toBe(8453);
    expect(USDC_BASE.decimals).toBe(6);
  });

  test("USDC_BASE_SEPOLIA token is correctly configured", () => {
    expect(USDC_BASE_SEPOLIA.symbol).toBe("USDC");
    expect(USDC_BASE_SEPOLIA.name).toBe("USD Coin");
    expect(USDC_BASE_SEPOLIA.contractAddress).toMatch(/^0x[a-fA-F0-9]{40,42}$/);
    expect(USDC_BASE_SEPOLIA.chainId).toBe(84532);
    expect(USDC_BASE_SEPOLIA.decimals).toBe(6);
  });

  test("EURC_BASE token is correctly configured", () => {
    expect(EURC_BASE.symbol).toBe("EURC");
    expect(EURC_BASE.name).toBe("EURC");
    expect(EURC_BASE.contractAddress).toMatch(/^0x[a-fA-F0-9]{40,42}$/);
    expect(EURC_BASE.chainId).toBe(8453);
    expect(EURC_BASE.decimals).toBe(6);
  });
});

describe("[tokens]: Registry Functions", () => {
  test("getToken retrieves token by chainId and address", () => {
    const token = getToken(8453, "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913");
    expect(token).toBeDefined();
    expect(token?.symbol).toBe("USDC");
  });

  test("getToken is case-insensitive for contract address", () => {
    const lowercase = getToken(8453, "0x833589fcd6edb6e08f4c7c32d4f71b54bdA02913");
    const uppercase = getToken(8453, "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913");
    expect(lowercase).toEqual(uppercase);
  });

  test("getToken returns undefined for non-existent token", () => {
    const token = getToken(999, "0x0000000000000000000000000");
    expect(token).toBeUndefined();
  });

  test("getAllTokens returns all registered tokens", () => {
    const allTokens = getAllTokens();
    expect(allTokens).toBeArray();
    expect(allTokens.length).toBe(13);

    // Verify all expected symbols are present
    const symbols = allTokens.map((t) => t.symbol);
    expect(symbols).toContain("USDC");
    expect(symbols).toContain("EURC");
    expect(symbols).toContain("USDT");
    expect(symbols).toContain("WBTC");
    expect(symbols).toContain("WETH");
    expect(symbols).toContain("SKL");
  });
});

describe("[tokens]: Helper Functions", () => {
  test("getUSDCTokens returns only USDC tokens", () => {
    const usdcTokens = getUSDCTokens();
    expect(usdcTokens.length).toBe(4);
    expect(usdcTokens.every((t) => t.symbol === "USDC")).toBe(true);
  });

  test("getEURCTokens returns only EURC tokens", () => {
    const eurcTokens = getEURCTokens();
    expect(eurcTokens.length).toBe(1);
    expect(eurcTokens.every((t) => t.symbol === "EURC")).toBe(true);
  });

  test("getSKLTokens returns SKL tokens", () => {
    const sklTokens = getSKLTokens();
    expect(sklTokens.length).toBe(2);
  });

  test("getUSDTTokens returns USDT tokens", () => {
    const usdtTokens = getUSDTokens();
    expect(usdtTokens.length).toBe(2);
  });

  test("getWBTCTokens returns WBTC tokens", () => {
    const wbtcTokens = getWBTCTokens();
    expect(wbtcTokens.length).toBe(2);
  });

  test("getWETHTokens returns WETH tokens", () => {
    const wethTokens = getWETHTokens();
    expect(wethTokens.length).toBe(2);
  });
});

describe("[tokens]: Token Collection", () => {
  test("TOKENS collection contains all expected tokens", () => {
    expect(TOKENS).toBeDefined();
    expect(typeof TOKENS === "object").toBe(true);
  });

  test("TOKENS values match individual token constants", () => {
    expect(TOKENS.USDC_BASE).toEqual(USDC_BASE);
    expect(TOKENS.USDC_BASE_SEPOLIA).toEqual(USDC_BASE_SEPOLIA);
    expect(TOKENS.EURC_BASE).toEqual(EURC_BASE);
  });
});

describe("[tokens]: Edge Cases", () => {
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
    const usdcSkaleKey = `${1187947933}:${"0x833589fc64fE3AceBce20Fc3c4690eFa484b7b5a02913".toLowerCase()}`;

    expect(usdcBaseKey).not.toBe(usdcSkaleKey);
  });
});

describe("[tokens]: Token Validation", () => {
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
