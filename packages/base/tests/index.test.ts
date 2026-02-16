import { describe, test, expect } from "bun:test";
import {
  V2_HEADERS,
  type PaymentPayloadV2,
  type PaymentRequirementsV2,
  type CAIP2ChainId,
  isPaymentPayloadV2,
  isPaymentPayload,
  getNetworkConfig,
  getNetworkByChainId,
  createEIP712Domain,
  EIP712_TYPES,
  createTransferWithAuthorization,
  validateTransferWithAuthorization,
  isCAIP2ChainId,
  isCAIPAssetId,
  isAddress,
} from "../src/index";

const DEFAULT_REQUIREMENTS: PaymentRequirementsV2 = {
  scheme: "exact",
  network: "eip155:84532",
  amount: "1000000",
  asset: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
  payTo: "0x1234567890123456789012345678901234567890",
  maxTimeoutSeconds: 300,
};

const TEST_NONCE = "0x0000000000000000000000000000000000000000000000000000000000000001" as `0x${string}`;

describe("[unit|base]: Base Package Tests", () => {
  describe("[unit|base]: V2 Headers", () => {
    test("[V2_HEADERS|success] - headers are correct", () => {
      expect(V2_HEADERS.PAYMENT_SIGNATURE).toBe("PAYMENT-SIGNATURE");
      expect(V2_HEADERS.PAYMENT_REQUIRED).toBe("PAYMENT-REQUIRED");
      expect(V2_HEADERS.PAYMENT_RESPONSE).toBe("PAYMENT-RESPONSE");
    });
  });

  describe("[unit|base]: PaymentPayload V2 Format", () => {
    test("[isPaymentPayloadV2|success] - validates accepted field", () => {
      const v2Payload: PaymentPayloadV2 = {
        x402Version: 2,
        accepted: DEFAULT_REQUIREMENTS,
        payload: {
          signature: "0x" + "b".repeat(130),
          authorization: {
            from: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1",
            to: "0x1234567890123456789012345678901234567890",
            value: "1000000",
            validAfter: "0",
            validBefore: "9999999999",
            nonce: "0x" + "0".repeat(64),
          },
        },
        resource: {
          url: "https://example.com/api/test",
          description: "Test resource",
        },
      };

      expect(isPaymentPayloadV2(v2Payload)).toBe(true);
      expect(isPaymentPayload(v2Payload)).toBe(true);
    });

    test("[isPaymentPayloadV2|failure] - rejects compact V2 format without defaults", () => {
      const compactPayload = {
        x402Version: 2,
        payload: {
          signature: "0x" + "b".repeat(130),
          authorization: {
            from: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1",
            to: "0x1234567890123456789012345678901234567890",
            value: "1000000",
            validAfter: "0",
            validBefore: "9999999999",
            nonce: "0x" + "0".repeat(64),
          },
        },
      };

      expect(isPaymentPayloadV2(compactPayload)).toBe(false);
      expect(isPaymentPayload(compactPayload)).toBe(false);
    });

    test("[isPaymentPayloadV2|failure] - rejects payload without accepted field", () => {
      const invalidPayload = {
        x402Version: 2,
        payload: {
          signature: "0x" + "b".repeat(130),
          authorization: {
            from: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1",
            to: "0x1234567890123456789012345678901234567890",
            value: "1000000",
            validAfter: "0",
            validBefore: "9999999999",
            nonce: "0x" + "0".repeat(64),
          },
        },
      };

      expect(isPaymentPayloadV2(invalidPayload)).toBe(false);
    });

    test("[isPaymentPayload|success] - new format has accepted field", () => {
      const newPayload = {
        x402Version: 2,
        accepted: DEFAULT_REQUIREMENTS,
        payload: {
          signature: "0x" + "b".repeat(130),
          authorization: {
            from: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1",
            to: "0x1234567890123456789012345678901234567890",
            value: "1000000",
            validAfter: "0",
            validBefore: "9999999999",
            nonce: "0x" + "0".repeat(64),
          },
        },
      };

      expect(isPaymentPayload(newPayload)).toBe(true);
      expect("accepted" in newPayload).toBe(true);
      expect("scheme" in newPayload).toBe(false);
      expect("network" in newPayload).toBe(false);
    });
  });

  describe("[unit|base]: Network Config", () => {
    test("[getNetworkConfig|success] - retrieves network by name", () => {
      const ethMainnet = getNetworkConfig("ethereum");
      expect(ethMainnet?.chainId).toBe(1);
      expect(ethMainnet?.name).toBe("Ethereum Mainnet");

      const baseMainnet = getNetworkConfig("base");
      expect(baseMainnet?.chainId).toBe(8453);

      const unknown = getNetworkConfig("unknown");
      expect(unknown).toBeUndefined();
    });

    test("[getNetworkConfig|error] - handles empty string", () => {
      expect(getNetworkConfig("")).toBeUndefined();
    });

    test("[getNetworkConfig|error] - case sensitive lookup", () => {
      expect(getNetworkConfig("Ethereum")).toBeUndefined();
      expect(getNetworkConfig("ETHEREUM")).toBeUndefined();
      expect(getNetworkConfig("ethereum")).toBeDefined();
    });

    test("[getNetworkConfig|error] - similar names are distinct", () => {
      expect(getNetworkConfig("base")).toBeDefined();
      expect(getNetworkConfig("bas")).toBeUndefined();
      expect(getNetworkConfig("base-mainnet")).toBeUndefined();
    });

    test("[getNetworkConfig|success] - handles special characters", () => {
      expect(getNetworkConfig("base-sepolia")).toBeDefined();
      expect(getNetworkConfig("base_sepolia")).toBeUndefined();
      expect(getNetworkConfig("base.sepolia")).toBeUndefined();
    });

    test("[getNetworkByChainId|error] - handles invalid chain IDs", () => {
      expect(getNetworkByChainId(-1)).toBeUndefined();
      expect(getNetworkByChainId(0)).toBeUndefined();
      expect(getNetworkByChainId(999999999)).toBeUndefined();
    });

    test("[getNetworkByChainId|success] - retrieves network by chain ID", () => {
      expect(getNetworkByChainId(1)?.name).toBe("Ethereum Mainnet");
      expect(getNetworkByChainId(8453)?.name).toBe("Base Mainnet");
      expect(getNetworkByChainId(84532)?.name).toBe("Base Sepolia");
    });
  });

  describe("[unit|base]: EIP-712", () => {
    test("[createEIP712Domain|success] - creates valid domain", () => {
      const domain = createEIP712Domain(
        1,
        "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"
      );

      expect(domain.name).toBe("USD Coin");
      expect(domain.version).toBe("2");
      expect(domain.chainId).toBe(1);
      expect(domain.verifyingContract).toBe("0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48");
    });

    test("[EIP712_TYPES|success] - types constant is correct", () => {
      expect(EIP712_TYPES.TransferWithAuthorization).toEqual([
        { name: "from", type: "address" },
        { name: "to", type: "address" },
        { name: "value", type: "uint256" },
        { name: "validAfter", type: "uint256" },
        { name: "validBefore", type: "uint256" },
        { name: "nonce", type: "bytes32" },
      ]);
    });
  });

  describe("[unit|base]: Transfer Authorization", () => {
    test("[createTransferWithAuthorization|success] - creates valid auth", () => {
      const auth = createTransferWithAuthorization({
        from: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0",
        to: "0x1234567890123456789012345678901234567890",
        value: 1000000,
        validAfter: 0,
        validBefore: Math.floor(Date.now() / 1000) + 3600,
        nonce: TEST_NONCE,
      });

      expect(validateTransferWithAuthorization(auth)).toBe(true);

      expect(() => {
        validateTransferWithAuthorization({
          ...auth,
          from: "invalid" as any,
        });
      }).toThrow();
    });

    test("[validateTransferWithAuthorization|error] - throws on invalid from address", () => {
      const validAuth = createTransferWithAuthorization({
        from: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0",
        to: "0x1234567890123456789012345678901234567890",
        value: 1000000,
        validAfter: 0,
        validBefore: 1000,
        nonce: TEST_NONCE,
      });

      expect(() => {
        validateTransferWithAuthorization({
          ...validAuth,
          from: "invalid",
        });
      }).toThrow('Invalid "from" address');
    });

    test("[validateTransferWithAuthorization|error] - throws on invalid to address", () => {
      const validAuth = createTransferWithAuthorization({
        from: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0",
        to: "0x1234567890123456789012345678901234567890",
        value: 1000000,
        validAfter: 0,
        validBefore: 1000,
        nonce: TEST_NONCE,
      });

      expect(() => {
        validateTransferWithAuthorization({
          ...validAuth,
          to: "not-an-address",
        });
      }).toThrow('Invalid "to" address');
    });

    test("[validateTransferWithAuthorization|error] - throws on negative value", () => {
      const auth = createTransferWithAuthorization({
        from: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0",
        to: "0x1234567890123456789012345678901234567890",
        value: -100,
        validAfter: 0,
        validBefore: 1000,
        nonce: TEST_NONCE,
      });

      expect(() => validateTransferWithAuthorization(auth)).toThrow('"value" must be non-negative');
    });

    test("[validateTransferWithAuthorization|error] - throws when validAfter >= validBefore", () => {
      const auth = createTransferWithAuthorization({
        from: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0",
        to: "0x1234567890123456789012345678901234567890",
        value: 1000000,
        validAfter: 1000,
        validBefore: 1000,
        nonce: TEST_NONCE,
      });

      expect(() => validateTransferWithAuthorization(auth)).toThrow('"validAfter" (1000) must be before "validBefore" (1000)');
    });

    test("[validateTransferWithAuthorization|error] - throws when validAfter > validBefore", () => {
      const auth = createTransferWithAuthorization({
        from: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0",
        to: "0x1234567890123456789012345678901234567890",
        value: 1000000,
        validAfter: 2000,
        validBefore: 1000,
        nonce: TEST_NONCE,
      });

      expect(() => validateTransferWithAuthorization(auth)).toThrow();
    });

    test("[validateTransferWithAuthorization|error] - throws on negative validAfter", () => {
      const auth = createTransferWithAuthorization({
        from: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0",
        to: "0x1234567890123456789012345678901234567890",
        value: 1000000,
        validAfter: -1,
        validBefore: 1000,
        nonce: TEST_NONCE,
      });

      expect(() => validateTransferWithAuthorization(auth)).toThrow('"validAfter" must be non-negative');
    });

    test("[validateTransferWithAuthorization|error] - throws on negative validBefore", () => {
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

    test("[validateTransferWithAuthorization|error] - throws on invalid nonce format", () => {
      const auth = {
        from: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0",
        to: "0x1234567890123456789012345678901234567890",
        value: 1000000n,
        validAfter: 0n,
        validBefore: 1000n,
        nonce: "invalid-nonce",
      };

      expect(() => validateTransferWithAuthorization(auth as any)).toThrow('"nonce" must be a valid bytes32 hex string');
    });

    test("[validateTransferWithAuthorization|success] - handles max safe integer values", () => {
      const auth = createTransferWithAuthorization({
        from: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0",
        to: "0x1234567890123456789012345678901234567890",
        value: Number.MAX_SAFE_INTEGER,
        validAfter: 0,
        validBefore: Number.MAX_SAFE_INTEGER,
        nonce: "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff" as `0x${string}`,
      });

      expect(validateTransferWithAuthorization(auth)).toBe(true);
    });

    test("[createTransferWithAuthorization|success] - converts number params to bigint", () => {
      const auth = createTransferWithAuthorization({
        from: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0",
        to: "0x1234567890123456789012345678901234567890",
        value: 12345,
        validAfter: 100,
        validBefore: 200,
        nonce: TEST_NONCE,
      });

      expect(typeof auth.value).toBe("bigint");
      expect(typeof auth.validAfter).toBe("bigint");
      expect(typeof auth.validBefore).toBe("bigint");
      expect(typeof auth.nonce).toBe("string");
      expect(auth.value).toBe(12345n);
      expect(auth.validAfter).toBe(100n);
      expect(auth.validBefore).toBe(200n);
      expect(auth.nonce).toBe(TEST_NONCE);
    });

    test("[createTransferWithAuthorization|success] - accepts bigint params", () => {
      const auth = createTransferWithAuthorization({
        from: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0",
        to: "0x1234567890123456789012345678901234567890",
        value: 12345n,
        validAfter: 100n,
        validBefore: 200n,
        nonce: TEST_NONCE,
      });

      expect(auth.value).toBe(12345n);
      expect(auth.validAfter).toBe(100n);
      expect(auth.validBefore).toBe(200n);
      expect(auth.nonce).toBe(TEST_NONCE);
    });
  });

  describe("[unit|base]: CAIP Type Guards", () => {
    test("[isCAIP2ChainId|success] - validates CAIP-2 chain IDs", () => {
      expect(isCAIP2ChainId("eip155:1")).toBe(true);
      expect(isCAIP2ChainId("eip155:8453")).toBe(true);
      expect(isCAIP2ChainId("eip155:0")).toBe(true);
      expect(isCAIP2ChainId("eip155:9999999999")).toBe(true);
    });

    test("[isCAIP2ChainId|error] - rejects invalid formats", () => {
      expect(isCAIP2ChainId("eip155:")).toBe(false);
      expect(isCAIP2ChainId(":1")).toBe(false);
      expect(isCAIP2ChainId("eip155:abc")).toBe(false);
      expect(isCAIP2ChainId("eip155:-1")).toBe(false);
      expect(isCAIP2ChainId("eip155:1.5")).toBe(false);
      expect(isCAIP2ChainId("EIP155:1")).toBe(false);
      expect(isCAIP2ChainId("")).toBe(false);
      expect(isCAIP2ChainId("eip155:1/extra")).toBe(false);
    });

    test("[isCAIPAssetId|success] - validates CAIP asset IDs", () => {
      expect(isCAIPAssetId("eip155:1/erc20:0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48")).toBe(true);
      expect(isCAIPAssetId("eip155:8453/erc20:0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913")).toBe(true);
      expect(isCAIPAssetId("eip155:1/erc20:0xabc")).toBe(true);
      expect(isCAIPAssetId("eip155:0/erc20:0x0000000000000000000000000000000000000000")).toBe(true);
    });

    test("[isCAIPAssetId|error] - rejects invalid formats", () => {
      expect(isCAIPAssetId("eip155:1/erc20:")).toBe(false);
      expect(isCAIPAssetId("eip155:1/erc20:0x")).toBe(false);
      expect(isCAIPAssetId("eip155:1/ERC20:0x123")).toBe(false);
      expect(isCAIPAssetId("eip155:1/erc20:GHI")).toBe(false);
      expect(isCAIPAssetId("eip155:1/:0x123")).toBe(false);
      expect(isCAIPAssetId("eip155:1/erc20:0x123/extra")).toBe(false);
      expect(isCAIPAssetId("")).toBe(false);
      expect(isCAIPAssetId("eip155:abc/erc20:0x123")).toBe(false);
    });

    test("[isAddress|success] - validates Ethereum addresses", () => {
      expect(isAddress("0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0")).toBe(true);
      expect(isAddress("0x0000000000000000000000000000000000000000")).toBe(true);
      expect(isAddress("0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF")).toBe(true);
      expect(isAddress("0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48")).toBe(true);
    });

    test("[isAddress|error] - rejects invalid addresses", () => {
      expect(isAddress("0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb")).toBe(false);
      expect(isAddress("0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb00")).toBe(false);
      expect(isAddress("742d35Cc6634C0532925a3b844Bc9e7595f0bEb0")).toBe(false);
      expect(isAddress("0xGHIJK35Cc6634C0532925a3b844Bc9e7595f0bEb0")).toBe(false);
      expect(isAddress("")).toBe(false);
      expect(isAddress("0x")).toBe(false);
      expect(isAddress("0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0 ")).toBe(false);
    });
  });
});
