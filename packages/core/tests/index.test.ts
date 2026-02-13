import { test, expect } from "bun:test";
import {
  type PaymentPayloadV1,
  V1_HEADERS,
  encodePaymentPayload,
  decodePaymentPayload,
  type CAIP2ChainId,
  V2_HEADERS,
  type PaymentPayload,
  isV1,
  isV2,
  isLegacyV1Payload,
  getNetworkConfig,
  getNetworkByChainId,
  detectPaymentVersion,
  createEIP712Domain,
  EIP712_TYPES,
  createTransferWithAuthorization,
  validateTransferWithAuthorization,
  isCAIP2ChainId,
  isCAIPAssetId,
  isAddress,
} from "../src/index";

test("V1 headers are correct", () => {
  expect(V1_HEADERS.PAYMENT).toBe("X-PAYMENT");
  expect(V1_HEADERS.PAYMENT_RESPONSE).toBe("X-PAYMENT-RESPONSE");
});

test("V2 headers are correct", () => {
  expect(V2_HEADERS.PAYMENT_SIGNATURE).toBe("PAYMENT-SIGNATURE");
  expect(V2_HEADERS.PAYMENT_REQUIRED).toBe("PAYMENT-REQUIRED");
  expect(V2_HEADERS.PAYMENT_RESPONSE).toBe("PAYMENT-RESPONSE");
});

test("encode and decode V1 payment payload", () => {
  const payload: PaymentPayloadV1 = {
    from: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0" as const,
    to: "0x1234567890123456789012345678901234567890" as const,
    amount: "1000000",
    nonce: "12345",
    expiry: 1234567890,
    v: 27,
    r: "0x1234567890123456789012345678901234567890123456789012345678901234",
    s: "0x1234567890123456789012345678901234567890123456789012345678901234",
    chainId: 1,
    contractAddress: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48" as const,
    network: "ethereum",
  };

  const encoded = encodePaymentPayload(payload);
  const decoded = decodePaymentPayload(encoded);

  expect(decoded.from).toBe(payload.from);
  expect(decoded.to).toBe(payload.to);
  expect(decoded.amount).toBe(payload.amount);
});

test("detect payment version from headers", () => {
  const v1Headers = new Headers();
  v1Headers.set("X-PAYMENT", "eyJmcm9tIjoiMHg...");

  const v2Headers = new Headers();
  v2Headers.set("PAYMENT-SIGNATURE", '{"from":"0x..."}');

  const emptyHeaders = new Headers();

  expect(detectPaymentVersion(v1Headers)).toBe(1);
  expect(detectPaymentVersion(v2Headers)).toBe(2);
  expect(detectPaymentVersion(emptyHeaders)).toBeNull();
});

test("type guards work correctly", () => {
  const v1Payload: PaymentPayload = {
    from: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0" as const,
    to: "0x1234567890123456789012345678901234567890" as const,
    amount: "1000000",
    nonce: "12345",
    expiry: 1234567890,
    v: 27,
    r: "0x1234567890123456789012345678901234567890123456789012345678901234",
    s: "0x1234567890123456789012345678901234567890123456789012345678901234",
    chainId: 1,
    contractAddress: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48" as const,
    network: "ethereum",
  };

  const v2Payload: PaymentPayload = {
    from: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0" as const,
    to: "0x1234567890123456789012345678901234567890" as const,
    amount: "1000000",
    nonce: "12345",
    expiry: 1234567890,
    signature: {
      v: 27,
      r: "0x1234567890123456789012345678901234567890123456789012345678901234",
      s: "0x1234567890123456789012345678901234567890123456789012345678901234",
    },
    chainId: "eip155:1" as CAIP2ChainId,
    assetId: "eip155:1/erc20:0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48" as const,
  };

  expect(isLegacyV1Payload(v1Payload)).toBe(true);
  expect(isV2(v1Payload)).toBe(false);
  expect(isV1(v2Payload)).toBe(false);
  expect(isV2(v2Payload)).toBe(true);
});

test("network config lookups work", () => {
  const ethMainnet = getNetworkConfig("ethereum");
  expect(ethMainnet?.chainId).toBe(1);
  expect(ethMainnet?.name).toBe("Ethereum Mainnet");

  const baseMainnet = getNetworkConfig("base");
  expect(baseMainnet?.chainId).toBe(8453);

  const unknown = getNetworkConfig("unknown");
  expect(unknown).toBeUndefined();
});

test("EIP-712 domain creation", () => {
  const domain = createEIP712Domain(
    1,
    "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"
  );

  expect(domain.name).toBe("USD Coin");
  expect(domain.version).toBe("2");
  expect(domain.chainId).toBe(1);
  expect(domain.verifyingContract).toBe("0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48");
});

test("EIP-712 types constant", () => {
  expect(EIP712_TYPES.TransferWithAuthorization).toEqual([
    { name: "from", type: "address" },
    { name: "to", type: "address" },
    { name: "value", type: "uint256" },
    { name: "validAfter", type: "uint256" },
    { name: "validBefore", type: "uint256" },
    { name: "nonce", type: "uint256" },
  ]);
});

test("create and validate transfer authorization", () => {
  const auth = createTransferWithAuthorization({
    from: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0",
    to: "0x1234567890123456789012345678901234567890",
    value: 1000000,
    validAfter: 0,
    validBefore: Math.floor(Date.now() / 1000) + 3600,
    nonce: Date.now(),
  });

  expect(validateTransferWithAuthorization(auth)).toBe(true);

  expect(() => {
    validateTransferWithAuthorization({
      ...auth,
      from: "invalid" as any,
    });
  }).toThrow();
});

// Encoding/decoding edge case tests

test("decode handles malformed base64", () => {
  expect(() => decodePaymentPayload("not-valid-base64!")).toThrow();
});

test("decode handles invalid JSON after base64 decode", () => {
  const invalidJson = Buffer.from("not-json").toString("base64");
  expect(() => decodePaymentPayload(invalidJson)).toThrow();
});

test("decode handles empty string", () => {
  expect(() => decodePaymentPayload("")).toThrow();
});

test("decode handles partial JSON (missing fields)", () => {
  const partialJson = Buffer.from(JSON.stringify({ from: "0x123" })).toString("base64");
  const decoded = decodePaymentPayload(partialJson);
  expect(decoded.from).toBe("0x123");
  // @ts-expect-error - testing runtime behavior with partial data
  expect(decoded.to).toBeUndefined();
});

test("encode handles unicode characters in values", () => {
  const payloadWithUnicode: PaymentPayloadV1 = {
    from: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0" as const,
    to: "0x1234567890123456789012345678901234567890" as const,
    amount: "1000000",
    nonce: "测试🔥", // unicode characters
    expiry: 1234567890,
    v: 27,
    r: "0x1234567890123456789012345678901234567890123456789012345678901234",
    s: "0x1234567890123456789012345678901234567890123456789012345678901234",
    chainId: 1,
    contractAddress: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48" as const,
    network: "ethereum",
  };

  const encoded = encodePaymentPayload(payloadWithUnicode);
  const decoded = decodePaymentPayload(encoded);
  expect(decoded.nonce).toBe(payloadWithUnicode.nonce);
});

test("encode handles empty strings", () => {
  const payloadWithEmpty: PaymentPayloadV1 = {
    from: "" as any,
    to: "",
    amount: "",
    nonce: "",
    expiry: 1234567890,
    v: 27,
    r: "0x1234567890123456789012345678901234567890123456789012345678901234",
    s: "0x1234567890123456789012345678901234567890123456789012345678901234",
    chainId: 1,
    contractAddress: "",
    network: "",
  };

  const encoded = encodePaymentPayload(payloadWithEmpty);
  const decoded = decodePaymentPayload(encoded);
  expect(decoded.from).toBe("");
  expect(decoded.network).toBe("");
});

test("encode handles very large numbers", () => {
  const payloadWithLargeNumbers: PaymentPayloadV1 = {
    from: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0" as const,
    to: "0x1234567890123456789012345678901234567890" as const,
    amount: "9007199254740991", // Number.MAX_SAFE_INTEGER
    nonce: "999999999999999999",
    expiry: 9999999999,
    v: 27,
    r: "0x1234567890123456789012345678901234567890123456789012345678901234",
    s: "0x1234567890123456789012345678901234567890123456789012345678901234",
    chainId: 1,
    contractAddress: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48" as const,
    network: "ethereum",
  };

  const encoded = encodePaymentPayload(payloadWithLargeNumbers);
  const decoded = decodePaymentPayload(encoded);
  expect(decoded.amount).toBe(payloadWithLargeNumbers.amount);
  expect(decoded.expiry).toBe(payloadWithLargeNumbers.expiry);
});

// Network config lookup error handling

test("getNetworkConfig with empty string", () => {
  expect(getNetworkConfig("")).toBeUndefined();
});

test("getNetworkConfig with case sensitivity", () => {
  expect(getNetworkConfig("Ethereum")).toBeUndefined();
  expect(getNetworkConfig("ETHEREUM")).toBeUndefined();
  expect(getNetworkConfig("ethereum")).toBeDefined();
});

test("getNetworkConfig with similar names", () => {
  expect(getNetworkConfig("base")).toBeDefined();
  expect(getNetworkConfig("bas")).toBeUndefined();
  expect(getNetworkConfig("base-mainnet")).toBeUndefined();
});

test("getNetworkConfig with special characters", () => {
  expect(getNetworkConfig("base-sepolia")).toBeDefined();
  expect(getNetworkConfig("base_sepolia")).toBeUndefined();
  expect(getNetworkConfig("base.sepolia")).toBeUndefined();
});

test("getNetworkByChainId with invalid chain IDs", () => {
  expect(getNetworkByChainId(-1)).toBeUndefined();
  expect(getNetworkByChainId(0)).toBeUndefined();
  expect(getNetworkByChainId(999999999)).toBeUndefined();
});

test("getNetworkByChainId with valid chain IDs", () => {
  expect(getNetworkByChainId(1)?.name).toBe("Ethereum Mainnet");
  expect(getNetworkByChainId(8453)?.name).toBe("Base Mainnet");
  expect(getNetworkByChainId(84532)?.name).toBe("Base Sepolia");
});

// CAIP type guard tests

test("isCAIP2ChainId with valid formats", () => {
  expect(isCAIP2ChainId("eip155:1")).toBe(true);
  expect(isCAIP2ChainId("eip155:8453")).toBe(true);
  expect(isCAIP2ChainId("eip155:0")).toBe(true);
  expect(isCAIP2ChainId("eip155:9999999999")).toBe(true);
});

test("isCAIP2ChainId with invalid formats", () => {
  expect(isCAIP2ChainId("eip155:")).toBe(false);
  expect(isCAIP2ChainId(":1")).toBe(false);
  expect(isCAIP2ChainId("eip155:abc")).toBe(false);
  expect(isCAIP2ChainId("eip155:-1")).toBe(false);
  expect(isCAIP2ChainId("eip155:1.5")).toBe(false);
  expect(isCAIP2ChainId("EIP155:1")).toBe(false); // case sensitive
  expect(isCAIP2ChainId("")).toBe(false);
  expect(isCAIP2ChainId("eip155:1/extra")).toBe(false);
});

test("isCAIPAssetId with valid formats", () => {
  expect(isCAIPAssetId("eip155:1/erc20:0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48")).toBe(true);
  expect(isCAIPAssetId("eip155:8453/erc20:0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913")).toBe(true);
  expect(isCAIPAssetId("eip155:1/erc20:0xabc")).toBe(true); // regex allows any hex length
  expect(isCAIPAssetId("eip155:0/erc20:0x0000000000000000000000000000000000000000")).toBe(true);
});

test("isCAIPAssetId with invalid formats", () => {
  expect(isCAIPAssetId("eip155:1/erc20:")).toBe(false);
  expect(isCAIPAssetId("eip155:1/erc20:0x")).toBe(false);
  expect(isCAIPAssetId("eip155:1/ERC20:0x123")).toBe(false); // case sensitive
  expect(isCAIPAssetId("eip155:1/erc20:GHI")).toBe(false); // invalid hex
  expect(isCAIPAssetId("eip155:1/:0x123")).toBe(false);
  expect(isCAIPAssetId("eip155:1/erc20:0x123/extra")).toBe(false);
  expect(isCAIPAssetId("")).toBe(false);
  expect(isCAIPAssetId("eip155:abc/erc20:0x123")).toBe(false);
});

test("isAddress with valid addresses", () => {
  expect(isAddress("0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0")).toBe(true);
  expect(isAddress("0x0000000000000000000000000000000000000000")).toBe(true);
  expect(isAddress("0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF")).toBe(true);
  expect(isAddress("0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48")).toBe(true);
});

test("isAddress with invalid addresses", () => {
  expect(isAddress("0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb")).toBe(false); // too short
  expect(isAddress("0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb00")).toBe(false); // too long
  expect(isAddress("742d35Cc6634C0532925a3b844Bc9e7595f0bEb0")).toBe(false); // missing 0x
  expect(isAddress("0xGHIJK35Cc6634C0532925a3b844Bc9e7595f0bEb0")).toBe(false); // invalid hex
  expect(isAddress("")).toBe(false);
  expect(isAddress("0x")).toBe(false);
  expect(isAddress("0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0 ")).toBe(false); // trailing space
});

// EIP-712 validation edge cases

test("validateTransferWithAuthorization with invalid from address", () => {
  const validAuth = createTransferWithAuthorization({
    from: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0",
    to: "0x1234567890123456789012345678901234567890",
    value: 1000000,
    validAfter: 0,
    validBefore: 1000,
    nonce: 1,
  });

  expect(() => {
    validateTransferWithAuthorization({
      ...validAuth,
      from: "invalid",
    });
  }).toThrow('Invalid "from" address');
});

test("validateTransferWithAuthorization with invalid to address", () => {
  const validAuth = createTransferWithAuthorization({
    from: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0",
    to: "0x1234567890123456789012345678901234567890",
    value: 1000000,
    validAfter: 0,
    validBefore: 1000,
    nonce: 1,
  });

  expect(() => {
    validateTransferWithAuthorization({
      ...validAuth,
      to: "not-an-address",
    });
  }).toThrow('Invalid "to" address');
});

test("validateTransferWithAuthorization with negative value", () => {
  const auth = createTransferWithAuthorization({
    from: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0",
    to: "0x1234567890123456789012345678901234567890",
    value: -100,
    validAfter: 0,
    validBefore: 1000,
    nonce: 1,
  });

  expect(() => validateTransferWithAuthorization(auth)).toThrow('"value" must be non-negative');
});

test("validateTransferWithAuthorization with validAfter >= validBefore", () => {
  const auth = createTransferWithAuthorization({
    from: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0",
    to: "0x1234567890123456789012345678901234567890",
    value: 1000000,
    validAfter: 1000,
    validBefore: 1000, // equal
    nonce: 1,
  });

  expect(() => validateTransferWithAuthorization(auth)).toThrow('"validAfter" (1000) must be before "validBefore" (1000)');
});

test("validateTransferWithAuthorization with validAfter > validBefore", () => {
  const auth = createTransferWithAuthorization({
    from: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0",
    to: "0x1234567890123456789012345678901234567890",
    value: 1000000,
    validAfter: 2000,
    validBefore: 1000, // reversed
    nonce: 1,
  });

  expect(() => validateTransferWithAuthorization(auth)).toThrow();
});

test("validateTransferWithAuthorization with negative validAfter", () => {
  const auth = createTransferWithAuthorization({
    from: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0",
    to: "0x1234567890123456789012345678901234567890",
    value: 1000000,
    validAfter: -1,
    validBefore: 1000,
    nonce: 1,
  });

  expect(() => validateTransferWithAuthorization(auth)).toThrow('"validAfter" must be non-negative');
});

test("validateTransferWithAuthorization with negative validBefore", () => {
  const auth = createTransferWithAuthorization({
    from: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0",
    to: "0x1234567890123456789012345678901234567890",
    value: 1000000,
    validAfter: 0,
    validBefore: -1,
    nonce: 1,
  });

  expect(() => validateTransferWithAuthorization(auth)).toThrow('"validBefore" must be non-negative');
});

test("validateTransferWithAuthorization with negative nonce", () => {
  const auth = createTransferWithAuthorization({
    from: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0",
    to: "0x1234567890123456789012345678901234567890",
    value: 1000000,
    validAfter: 0,
    validBefore: 1000,
    nonce: -1,
  });

  expect(() => validateTransferWithAuthorization(auth)).toThrow('"nonce" must be non-negative');
});

test("validateTransferWithAuthorization with max safe integer values", () => {
  const auth = createTransferWithAuthorization({
    from: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0",
    to: "0x1234567890123456789012345678901234567890",
    value: Number.MAX_SAFE_INTEGER,
    validAfter: 0,
    validBefore: Number.MAX_SAFE_INTEGER,
    nonce: Number.MAX_SAFE_INTEGER,
  });

  expect(validateTransferWithAuthorization(auth)).toBe(true);
});

test("createTransferWithAuthorization converts number params to bigint", () => {
  const auth = createTransferWithAuthorization({
    from: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0",
    to: "0x1234567890123456789012345678901234567890",
    value: 12345,
    validAfter: 100,
    validBefore: 200,
    nonce: 999,
  });

  expect(typeof auth.value).toBe("bigint");
  expect(typeof auth.validAfter).toBe("bigint");
  expect(typeof auth.validBefore).toBe("bigint");
  expect(typeof auth.nonce).toBe("bigint");
  expect(auth.value).toBe(12345n);
  expect(auth.validAfter).toBe(100n);
  expect(auth.validBefore).toBe(200n);
  expect(auth.nonce).toBe(999n);
});

test("createTransferWithAuthorization accepts bigint params", () => {
  const auth = createTransferWithAuthorization({
    from: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0",
    to: "0x1234567890123456789012345678901234567890",
    value: 12345n,
    validAfter: 100n,
    validBefore: 200n,
    nonce: 999n,
  });

  expect(auth.value).toBe(12345n);
  expect(auth.validAfter).toBe(100n);
  expect(auth.validBefore).toBe(200n);
  expect(auth.nonce).toBe(999n);
});
