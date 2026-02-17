/**
 * @armory-sh/client-web3 Tests
 */

import { expect, mock, test } from "bun:test";
import type { SettlementResponseV2 } from "@armory-sh/base";
import {
  adjustVForChainId,
  concatenateSignature,
  createEIP712Domain,
  createTransferWithAuthorization,
  createX402Client,
  createX402Transport,
  parseSignature,
  signTypedData,
  signWithPrivateKey,
  validateTransferWithAuthorization,
} from "../src/index";

// ============================================================================
// Test Utilities
// ============================================================================

function createMockAccount(address: string) {
  return {
    address,
    privateKey: `0x${"a".repeat(64)}`,
  };
}

// ============================================================================
// EIP-712 Tests
// ============================================================================

test("createEIP712Domain creates valid domain", () => {
  const domain = createEIP712Domain(
    8453,
    "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  );

  expect(domain.name).toBe("USD Coin");
  expect(domain.version).toBe("2");
  expect(domain.chainId).toBe("0x2105"); // 8453 in hex
  expect(domain.verifyingContract).toBe(
    "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
  );
});

test("createTransferWithAuthorization creates valid message", () => {
  const message = createTransferWithAuthorization({
    from: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
    to: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    value: "1000000",
    validAfter: "0x0",
    validBefore: "0x1740000000",
    nonce: "0x123456",
  });

  expect(message.from).toBe("0x742d35cc6634c0532925a3b844bc9e7595f0beb");
  expect(message.to).toBe("0x833589fcd6edb6e08f4c7c32d4f71b54bda02913");
  expect(message.value).toBe("1000000");
  expect(message.validAfter).toBe("0x0");
  expect(message.validBefore).toBe("0x1740000000");
  expect(message.nonce).toBe("0x123456");
});

test("parseSignature splits signature into components", () => {
  const r = "r".padStart(64, "0");
  const s = "s".padStart(64, "0");
  const v = "1b"; // 27 in hex
  const signature = `0x${r}${s}${v}`;

  const result = parseSignature(signature);

  expect(result.v).toBe(27);
  expect(result.r).toBe(`0x${r}`);
  expect(result.s).toBe(`0x${s}`);
});

test("concatenateSignature combines components", () => {
  const signature = concatenateSignature(
    27,
    `0x${"r".padStart(64, "0")}`,
    `0x${"s".padStart(64, "0")}`,
  );

  expect(signature).toHaveLength(132); // 0x + 130 hex chars
  expect(signature.startsWith("0x")).toBeTrue();
});

test("concatenateSignature handles inputs without 0x prefix", () => {
  const r = "r".padStart(64, "0");
  const s = "s".padStart(64, "0");
  const signature = concatenateSignature(28, r, s);

  expect(signature).toBe(`0x${r}${s}1c`);
});

test("concatenateSignature pads v value", () => {
  const signature = concatenateSignature(
    1,
    `0x${"r".padStart(64, "0")}`,
    `0x${"s".padStart(64, "0")}`,
  );

  expect(signature).toEndWith("01");
});

test("parseSignature throws on invalid length", () => {
  expect(() => parseSignature("0x1234")).toThrow("Invalid signature length");
});

test("parseSignature handles signature without 0x prefix", () => {
  const r = "a".repeat(64);
  const s = "b".repeat(64);
  const v = "1c"; // 28 in hex
  const signature = `${r}${s}${v}`;

  const result = parseSignature(signature);

  expect(result.v).toBe(28);
  expect(result.r).toBe(`0x${r}`);
  expect(result.s).toBe(`0x${s}`);
});

test("parseSignature with v value 27", () => {
  const r = "c".repeat(64);
  const s = "d".repeat(64);
  const signature = `0x${r}${s}1b`;

  const result = parseSignature(signature);

  expect(result.v).toBe(27);
});

test("parseSignature with v value 28", () => {
  const r = "e".repeat(64);
  const s = "f".repeat(64);
  const signature = `0x${r}${s}1c`;

  const result = parseSignature(signature);

  expect(result.v).toBe(28);
});

// ============================================================================
// EIP-3009 Signing Tests
// ============================================================================

test("validateTransferWithAuthorization validates valid message", () => {
  const message = {
    from: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1",
    to: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    value: "1000000",
    validAfter: "0x0",
    validBefore: "0x1740000000",
    nonce: "0x123456",
  };

  expect(validateTransferWithAuthorization(message)).toBeTrue();
});

test("validateTransferWithAuthorization throws on invalid from address", () => {
  const message = {
    from: "invalid-address",
    to: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    value: "1000000",
    validAfter: "0x0",
    validBefore: "0x1740000000",
    nonce: "0x123456",
  };

  expect(() => validateTransferWithAuthorization(message)).toThrow(
    'Invalid "from" address',
  );
});

test("validateTransferWithAuthorization throws on invalid to address", () => {
  const message = {
    from: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1",
    to: "not-an-address",
    value: "1000000",
    validAfter: "0x0",
    validBefore: "0x1740000000",
    nonce: "0x123456",
  };

  expect(() => validateTransferWithAuthorization(message)).toThrow(
    'Invalid "to" address',
  );
});

test("validateTransferWithAuthorization throws on negative value", () => {
  const message = {
    from: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1",
    to: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    value: "-100",
    validAfter: "0x0",
    validBefore: "0x1740000000",
    nonce: "0x123456",
  };

  expect(() => validateTransferWithAuthorization(message)).toThrow(
    '"value" must be non-negative',
  );
});

test("validateTransferWithAuthorization throws when validAfter >= validBefore", () => {
  const message = {
    from: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1",
    to: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    value: "1000000",
    validAfter: "0x1740000000",
    validBefore: "0x1740000000",
    nonce: "0x123456",
  };

  expect(() => validateTransferWithAuthorization(message)).toThrow(
    'must be before "validBefore"',
  );
});

test("validateTransferWithAuthorization throws on negative nonce", () => {
  const message = {
    from: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1",
    to: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    value: "1000000",
    validAfter: "0x0",
    validBefore: "0x1740000000",
    nonce: "-1",
  };

  expect(() => validateTransferWithAuthorization(message)).toThrow(
    '"nonce" must be non-negative',
  );
});

test("adjustVForChainId returns v for 27", () => {
  expect(adjustVForChainId(27, 1)).toBe(27);
});

test("adjustVForChainId returns v for 28", () => {
  expect(adjustVForChainId(28, 1)).toBe(28);
});

test("adjustVForChainId adjusts chain-specific v", () => {
  // Chain-specific v = chainId * 2 + 35
  // For chainId 1: 1 * 2 + 35 = 37
  // adjustVForChainId should normalize back to 27 or 28
  const chainSpecificV = 1 * 2 + 35;
  expect(adjustVForChainId(chainSpecificV, 1)).toBe(27);
});

test("signTypedData throws error (not implemented)", async () => {
  const domain = createEIP712Domain(1, `0x${"a".repeat(40)}`);
  const message = createTransferWithAuthorization({
    from: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
    to: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    value: "1000000",
    validAfter: "0x0",
    validBefore: "0x1740000000",
    nonce: "0x123456",
  });

  await expect(signTypedData({}, domain, message)).rejects.toThrow(
    "EIP-712 signing requires web3-eth-personal",
  );
});

test("signWithPrivateKey throws error (not implemented)", async () => {
  const domain = createEIP712Domain(1, `0x${"a".repeat(40)}`);
  const message = createTransferWithAuthorization({
    from: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
    to: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    value: "1000000",
    validAfter: "0x0",
    validBefore: "0x1740000000",
    nonce: "0x123456",
  });

  await expect(
    signWithPrivateKey(`0x${"a".repeat(64)}`, domain, message),
  ).rejects.toThrow("Direct private key signing not implemented");
});

// ============================================================================
// Enhanced Client Creation Tests
// ============================================================================

test("createX402Client with custom rpcUrl", () => {
  const account = createMockAccount(
    "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
  );
  const customRpcUrl = "https://custom-rpc.example.com";
  const client = createX402Client({
    account,
    network: "base",
    rpcUrl: customRpcUrl,
  });

  expect(client.getVersion()).toBe(2);
  expect(client.getNetwork().name).toBe("Base Mainnet");
});

test("createX402Client with network config object", () => {
  const account = createMockAccount(
    "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
  );
  const networkConfig = {
    name: "Custom Network",
    chainId: 12345,
    rpcUrl: "https://custom.network",
    usdcAddress: `0x${"b".repeat(40)}`,
    caip2Id: "eip155:12345" as const,
    caipAssetId: `eip155:12345/erc20:0x${"b".repeat(40)}` as const,
  };
  const client = createX402Client({
    account,
    network: networkConfig,
  });

  expect(client.getNetwork().chainId).toBe(12345);
  expect(client.getNetwork().name).toBe("Custom Network");
});

test("createX402Client with custom domain name and version", () => {
  const account = createMockAccount(
    "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
  );
  const client = createX402Client({
    account,
    network: "base",
    domainName: "Custom Token",
    domainVersion: "3",
  });

  expect(client.getVersion()).toBe(2);
  expect(client.getNetwork().name).toBe("Base Mainnet");
});

test("createX402Client returns account accessor", () => {
  const account = createMockAccount(
    "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
  );
  const client = createX402Client({
    account,
    network: "base",
  });

  expect(client.getAccount()).toBe(account);
});

test("createX402Client for ethereum mainnet", () => {
  const account = createMockAccount(
    "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
  );
  const client = createX402Client({
    account,
    network: "ethereum",
  });

  expect(client.getNetwork().name).toBe("Ethereum Mainnet");
  expect(client.getNetwork().chainId).toBe(1);
});

test("createX402Client for multiple networks", () => {
  const account = createMockAccount(
    "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
  );

  const baseClient = createX402Client({
    account,
    network: "base",
  });
  expect(baseClient.getNetwork().chainId).toBe(8453);

  const ethClient = createX402Client({
    account,
    network: "ethereum",
  });
  expect(ethClient.getNetwork().chainId).toBe(1);
});

test("createEIP712Domain with custom domain name and version", () => {
  const domain = createEIP712Domain(
    8453,
    "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    "Custom Token",
    "3",
  );

  expect(domain.name).toBe("Custom Token");
  expect(domain.version).toBe("3");
  expect(domain.chainId).toBe("0x2105");
  expect(domain.verifyingContract).toBe(
    "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
  );
});

test("createTransferWithAuthorization with bigint values", () => {
  const message = createTransferWithAuthorization({
    from: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
    to: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    value: 1000000n,
    validAfter: 0n,
    validBefore: 1740000000n,
    nonce: 0x123456n,
  });

  expect(message.value).toBe("1000000");
  expect(message.validAfter).toBe("0");
  expect(message.validBefore).toBe("1740000000");
  expect(message.nonce).toBe("1193046");
});

test("createTransferWithAuthorization normalizes addresses to lowercase", () => {
  const message = createTransferWithAuthorization({
    from: "0x742D35CC6634C0532925A3B844BC9E7595F0BEB1",
    to: "0x833589FCD6EDB6E08F4C7C32D4F71B54BDA02913",
    value: "1000000",
    validAfter: "0x0",
    validBefore: "0x1740000000",
    nonce: "0x123456",
  });

  expect(message.from).toBe("0x742d35cc6634c0532925a3b844bc9e7595f0beb1");
  expect(message.to).toBe("0x833589fcd6edb6e08f4c7c32d4f71b54bda02913");
});

// ============================================================================
// Client Tests
// ============================================================================

test("createX402Client creates v2 client by default", () => {
  const account = createMockAccount(
    "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
  );
  const client = createX402Client({
    account,
    network: "base",
  });

  expect(client.getVersion()).toBe(2);
  expect(client.getNetwork().name).toBe("Base Mainnet");
  expect(client.getNetwork().chainId).toBe(8453);
});

test("createX402Client throws on unknown network", () => {
  const account = createMockAccount(
    "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
  );

  expect(() => {
    createX402Client({
      account,
      network: "unknown-network",
    });
  }).toThrow("Unknown network");
});

test("createX402Client works without network config", () => {
  const account = createMockAccount(
    "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
  );
  const client = createX402Client({
    account,
  });

  expect(client.getNetwork()).toBeUndefined();
  expect(client.getAccount()).toBe(account);
  expect(client.getVersion()).toBe(2);
});

test("createX402Client requires network for manual payment signing", async () => {
  const account = createMockAccount(
    "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
  );
  const client = createX402Client({
    account,
  });

  const promise = client.signPayment({
    amount: "1000000",
    to: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
  });

  await expect(promise).rejects.toThrow(
    "Network must be configured for manual payment signing",
  );
});

// ============================================================================
// Settlement Verification Tests
// ============================================================================

test("client verifies successful v2 settlement", () => {
  const account = createMockAccount(
    "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
  );
  const client = createX402Client({
    account,
    network: "base",
  });

  const response: SettlementResponseV2 = {
    success: true,
    transaction: "0xabc123",
    network: "eip155:8453",
  };

  expect(client.verifySettlement(response)).toBeTrue();
});

test("client verifies pending v2 settlement as unsuccessful", () => {
  const account = createMockAccount(
    "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
  );
  const client = createX402Client({
    account,
    network: "base",
  });

  const response: SettlementResponseV2 = {
    status: "pending",
    txId: "pending-123",
    timestamp: Date.now(),
  };

  expect(client.verifySettlement(response)).toBeFalse();
});

// ============================================================================
// Transport Tests
// ============================================================================

test("createX402Transport creates transport with client", () => {
  const account = createMockAccount(
    "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
  );
  const client = createX402Client({
    account,
    network: "base",
  });

  const transport = createX402Transport({ client });

  expect(transport.getClient()).toBe(client);
});

test("createX402Transport creates transport with custom options", () => {
  const account = createMockAccount(
    "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
  );
  const client = createX402Client({
    account,
    network: "base",
  });

  const transport = createX402Transport({
    client,
    autoSign: false,
    maxRetries: 5,
  });

  expect(transport.getClient()).toBe(client);
});

// ============================================================================
// Integration Tests (with mocked fetch)
// ============================================================================

test("transport fetch returns response for successful request", async () => {
  const account = createMockAccount(
    "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
  );
  const client = createX402Client({
    account,
    network: "base",
  });

  const transport = createX402Transport({ client, autoSign: false });

  // Mock global fetch
  const mockFetch = mock(() =>
    Promise.resolve(
      new Response(JSON.stringify({ data: "test" }), { status: 200 }),
    ),
  );
  globalThis.fetch = mockFetch;

  const response = await transport.fetch("https://api.example.com/data");

  expect(response.status).toBe(200);
  expect(mockFetch).toHaveBeenCalled();
});

test("transport fetch returns 402 when autoSign is false", async () => {
  const account = createMockAccount(
    "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
  );
  const client = createX402Client({
    account,
    network: "base",
  });

  const transport = createX402Transport({ client, autoSign: false });

  // Mock global fetch
  const mockFetch = mock(() =>
    Promise.resolve(
      new Response(JSON.stringify({ error: "Payment required" }), {
        status: 402,
        headers: {
          "PAYMENT-REQUIRED": JSON.stringify({
            amount: "1000000",
            to: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
            chainId: "eip155:8453",
            assetId:
              "eip155:8453/erc20:0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
            nonce: "test-nonce",
            expiry: Date.now() + 3600,
          }),
        },
      }),
    ),
  );
  globalThis.fetch = mockFetch;

  const response = await transport.fetch("https://api.example.com/data");

  expect(response.status).toBe(402);
});
