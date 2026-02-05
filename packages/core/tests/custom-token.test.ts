import { test, expect } from "bun:test";
import {
  registerToken,
  getCustomToken,
  getAllCustomTokens,
  unregisterToken,
  isCustomToken,
} from "../src/types/networks";

test("registerToken adds custom token", () => {
  const token = registerToken({
    symbol: "MYTOKEN",
    name: "My Custom Token",
    version: "1",
    contractAddress: "0x1234567890123456789012345678901234567890" as const,
    chainId: 1,
    decimals: 18,
  });

  expect(token.symbol).toBe("MYTOKEN");
  expect(token.name).toBe("My Custom Token");
  expect(token.version).toBe("1");
});

test("getCustomToken retrieves registered token", () => {
  registerToken({
    symbol: "TEST",
    name: "Test Token",
    version: "1",
    contractAddress: "0xABCDEF0123456789012345678901234567890123" as const,
    chainId: 1,
    decimals: 6,
  });

  const token = getCustomToken(1, "0xABCDEF0123456789012345678901234567890123");
  expect(token).toBeDefined();
  expect(token?.symbol).toBe("TEST");
});

test("isCustomToken returns true for registered tokens", () => {
  registerToken({
    symbol: "CHECK",
    name: "Check Token",
    version: "1",
    contractAddress: "0x9999999999999999999999999999999999999999" as const,
    chainId: 8453,
    decimals: 18,
  });

  expect(isCustomToken(8453, "0x9999999999999999999999999999999999999999")).toBe(true);
  expect(isCustomToken(1, "0x0000000000000000000000000000000000000001")).toBe(false);
});

test("getAllCustomTokens returns all registered tokens", () => {
  unregisterToken(1, "0x1234567890123456789012345678901234567890");
  unregisterToken(1, "0xABCDEF0123456789012345678901234567890123");
  unregisterToken(8453, "0x9999999999999999999999999999999999999999");

  registerToken({
    symbol: "TOKEN1",
    name: "Token One",
    version: "1",
    contractAddress: "0x1111111111111111111111111111111111111111" as const,
    chainId: 1,
    decimals: 18,
  });

  registerToken({
    symbol: "TOKEN2",
    name: "Token Two",
    version: "1",
    contractAddress: "0x2222222222222222222222222222222222222222" as const,
    chainId: 8453,
    decimals: 6,
  });

  const tokens = getAllCustomTokens();
  expect(tokens.length).toBeGreaterThanOrEqual(2);
});

test("unregisterToken removes custom token", () => {
  registerToken({
    symbol: "TEMP",
    name: "Temporary Token",
    version: "1",
    contractAddress: "0x5555555555555555555555555555555555555555" as const,
    chainId: 1,
    decimals: 18,
  });

  expect(isCustomToken(1, "0x5555555555555555555555555555555555555555")).toBe(true);

  const removed = unregisterToken(1, "0x5555555555555555555555555555555555555555");
  expect(removed).toBe(true);
  expect(isCustomToken(1, "0x5555555555555555555555555555555555555555")).toBe(false);
});
