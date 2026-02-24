import { describe, expect, mock, test } from "bun:test";
import { generateCdpJwt } from "../src/jwt";
import {
  CDP_FACILITATOR_HOST,
  CDP_FACILITATOR_URL,
  cdpSettle,
  cdpVerify,
  createCdpFacilitatorConfig,
} from "../src/facilitator";
import type { CdpCredentials } from "../src/facilitator";
import type { PaymentPayload, PaymentRequirements } from "@armory-sh/base";

const TEST_EC_KEY = `-----BEGIN PRIVATE KEY-----
MIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQgmxCVwnY5uN6nLq52
/XwFVRmBnJrqX19RSpiRLruzdumhRANCAAR5/93hawCsGN+zYMulKem7Sw+z7QtJ
NdvivrgDXHsrKdqNcNVF69n0mpIAbJHSWJMWv4l+df7gqVjc+unqTAiD
-----END PRIVATE KEY-----`;

const MOCK_PAYMENT_REQUIREMENTS: PaymentRequirements = {
  scheme: "exact",
  network: "eip155:8453",
  amount: "1000000",
  asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  payTo: "0x1234567890123456789012345678901234567890",
  maxTimeoutSeconds: 300,
};

const MOCK_PAYMENT_PAYLOAD: PaymentPayload = {
  x402Version: 2,
  accepted: MOCK_PAYMENT_REQUIREMENTS,
  payload: {
    signature: `0x${"a".repeat(130)}`,
    authorization: {
      from: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0",
      to: "0x1234567890123456789012345678901234567890",
      value: "1000000",
      validAfter: "0",
      validBefore: "9999999999",
      nonce: `0x${"0".repeat(64)}`,
    },
  },
};

describe("[unit|cdp-auth]: CDP Auth Package", () => {
  describe("[unit|cdp-auth]: Constants", () => {
    test("[CDP_FACILITATOR_URL|success] - has correct base URL", () => {
      expect(CDP_FACILITATOR_URL).toBe(
        "https://api.cdp.coinbase.com/platform/x402/v2",
      );
    });

    test("[CDP_FACILITATOR_HOST|success] - has correct host", () => {
      expect(CDP_FACILITATOR_HOST).toBe("api.cdp.coinbase.com");
    });
  });

  describe("[unit|cdp-auth]: generateCdpJwt", () => {
    test("[generateCdpJwt|error] - throws when apiKeyId is missing", async () => {
      await expect(
        generateCdpJwt({
          apiKeyId: "",
          apiKeySecret: "secret",
          requestMethod: "POST",
          requestHost: "api.cdp.coinbase.com",
          requestPath: "/verify",
        }),
      ).rejects.toThrow("apiKeyId is required");
    });

    test("[generateCdpJwt|error] - throws when apiKeySecret is missing", async () => {
      await expect(
        generateCdpJwt({
          apiKeyId: "key-id",
          apiKeySecret: "",
          requestMethod: "POST",
          requestHost: "api.cdp.coinbase.com",
          requestPath: "/verify",
        }),
      ).rejects.toThrow("apiKeySecret is required");
    });

    test("[generateCdpJwt|error] - throws on invalid key format", async () => {
      await expect(
        generateCdpJwt({
          apiKeyId: "key-id",
          apiKeySecret: "not-a-valid-key",
          requestMethod: "POST",
          requestHost: "api.cdp.coinbase.com",
          requestPath: "/verify",
        }),
      ).rejects.toThrow("Invalid key format");
    });

    test("[generateCdpJwt|success] - generates JWT with EC key", async () => {
      const token = await generateCdpJwt({
        apiKeyId: "test-key-id",
        apiKeySecret: TEST_EC_KEY,
        requestMethod: "POST",
        requestHost: "api.cdp.coinbase.com",
        requestPath: "/verify",
      });

      expect(typeof token).toBe("string");
      const parts = token.split(".");
      expect(parts).toHaveLength(3);

      const header = JSON.parse(
        Buffer.from(parts[0]!, "base64url").toString(),
      );
      expect(header.alg).toBe("ES256");
      expect(header.kid).toBe("test-key-id");
      expect(header.typ).toBe("JWT");
      expect(typeof header.nonce).toBe("string");

      const payload = JSON.parse(
        Buffer.from(parts[1]!, "base64url").toString(),
      );
      expect(payload.sub).toBe("test-key-id");
      expect(payload.iss).toBe("cdp");
      expect(payload.uris).toEqual([
        "POST api.cdp.coinbase.com/verify",
      ]);
      expect(typeof payload.iat).toBe("number");
      expect(typeof payload.exp).toBe("number");
      expect(payload.exp - payload.iat).toBeLessThanOrEqual(120);
    });

    test("[generateCdpJwt|success] - respects custom expiresIn", async () => {
      const token = await generateCdpJwt({
        apiKeyId: "test-key-id",
        apiKeySecret: TEST_EC_KEY,
        requestMethod: "GET",
        requestHost: "api.cdp.coinbase.com",
        requestPath: "/supported",
        expiresIn: 300,
      });

      const parts = token.split(".");
      const payload = JSON.parse(
        Buffer.from(parts[1]!, "base64url").toString(),
      );
      expect(payload.exp - payload.iat).toBeLessThanOrEqual(300);
      expect(payload.uris).toEqual(["GET api.cdp.coinbase.com/supported"]);
    });
  });

  describe("[unit|cdp-auth]: createCdpFacilitatorConfig", () => {
    test("[createCdpFacilitatorConfig|success] - returns config with correct URL", async () => {
      const credentials: CdpCredentials = {
        apiKeyId: "test-key-id",
        apiKeySecret: TEST_EC_KEY,
      };
      const config = await createCdpFacilitatorConfig(credentials);

      expect(config.url).toBe(CDP_FACILITATOR_URL);
      expect(config.headers).toBeDefined();
      expect(config.headers!["Authorization"]).toMatch(/^Bearer /);
      expect(config.headers!["Content-Type"]).toBe("application/json");
    });

    test("[createCdpFacilitatorConfig|success] - uses custom path in JWT uris", async () => {
      const credentials: CdpCredentials = {
        apiKeyId: "test-key-id",
        apiKeySecret: TEST_EC_KEY,
      };
      const config = await createCdpFacilitatorConfig(credentials, "/settle");
      const token = config.headers!["Authorization"]!.replace("Bearer ", "");
      const parts = token.split(".");
      const payload = JSON.parse(
        Buffer.from(parts[1]!, "base64url").toString(),
      );
      expect(payload.uris[0]).toContain("/settle");
    });
  });

  describe("[unit|cdp-auth]: cdpVerify", () => {
    test("[cdpVerify|success] - calls verify with CDP auth headers", async () => {
      const credentials: CdpCredentials = {
        apiKeyId: "test-key-id",
        apiKeySecret: TEST_EC_KEY,
      };

      let capturedRequest: RequestInit | undefined;
      global.fetch = mock((url: string, init?: RequestInit) => {
        capturedRequest = init;
        return Promise.resolve(
          new Response(JSON.stringify({ isValid: true, payer: "0x123" }), {
            status: 200,
          }),
        );
      });

      const result = await cdpVerify(
        MOCK_PAYMENT_PAYLOAD,
        MOCK_PAYMENT_REQUIREMENTS,
        credentials,
      );

      expect(result.isValid).toBe(true);
      const authHeader = new Headers(capturedRequest?.headers).get(
        "Authorization",
      );
      expect(authHeader).toMatch(/^Bearer /);
    });

    test("[cdpVerify|error] - propagates facilitator error", async () => {
      const credentials: CdpCredentials = {
        apiKeyId: "test-key-id",
        apiKeySecret: TEST_EC_KEY,
      };

      global.fetch = mock(() =>
        Promise.resolve(
          new Response("Unauthorized", { status: 401 }),
        ),
      );

      await expect(
        cdpVerify(MOCK_PAYMENT_PAYLOAD, MOCK_PAYMENT_REQUIREMENTS, credentials),
      ).rejects.toThrow();
    });
  });

  describe("[unit|cdp-auth]: cdpSettle", () => {
    test("[cdpSettle|success] - calls settle with CDP auth headers", async () => {
      const credentials: CdpCredentials = {
        apiKeyId: "test-key-id",
        apiKeySecret: TEST_EC_KEY,
      };

      let capturedRequest: RequestInit | undefined;
      global.fetch = mock((url: string, init?: RequestInit) => {
        capturedRequest = init;
        return Promise.resolve(
          new Response(
            JSON.stringify({
              success: true,
              transaction: "0xabc",
              network: "eip155:8453",
              payer: "0x123",
            }),
            { status: 200 },
          ),
        );
      });

      const result = await cdpSettle(
        MOCK_PAYMENT_PAYLOAD,
        MOCK_PAYMENT_REQUIREMENTS,
        credentials,
      );

      expect(result.success).toBe(true);
      const authHeader = new Headers(capturedRequest?.headers).get(
        "Authorization",
      );
      expect(authHeader).toMatch(/^Bearer /);
    });

    test("[cdpSettle|success] - uses /settle path in JWT uris", async () => {
      const credentials: CdpCredentials = {
        apiKeyId: "test-key-id",
        apiKeySecret: TEST_EC_KEY,
      };

      let capturedAuthHeader: string | null = null;
      global.fetch = mock((_url: string, init?: RequestInit) => {
        capturedAuthHeader = new Headers(init?.headers).get("Authorization");
        return Promise.resolve(
          new Response(
            JSON.stringify({
              success: true,
              transaction: "0xabc",
              network: "eip155:8453",
            }),
            { status: 200 },
          ),
        );
      });

      await cdpSettle(
        MOCK_PAYMENT_PAYLOAD,
        MOCK_PAYMENT_REQUIREMENTS,
        credentials,
      );

      expect(capturedAuthHeader).toMatch(/^Bearer /);
      const token = capturedAuthHeader!.replace("Bearer ", "");
      const parts = token.split(".");
      const payload = JSON.parse(
        Buffer.from(parts[1]!, "base64url").toString(),
      );
      expect(payload.uris[0]).toContain("/settle");
    });
  });
});
