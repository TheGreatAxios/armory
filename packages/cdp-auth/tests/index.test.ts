import { describe, expect, mock, test } from "bun:test";
import { generateCdpJwt } from "../src/jwt";
import {
  CDP_FACILITATOR_HOST,
  CDP_FACILITATOR_URL,
  generateCdpHeaders,
} from "../src/facilitator";
import type { GenerateCdpHeadersOptions } from "../src/facilitator";

const TEST_EC_KEY = `-----BEGIN PRIVATE KEY-----
MIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQgmxCVwnY5uN6nLq52
/XwFVRmBnJrqX19RSpiRLruzdumhRANCAAR5/93hawCsGN+zYMulKem7Sw+z7QtJ
NdvivrgDXHsrKdqNcNVF69n0mpIAbJHSWJMWv4l+df7gqVjc+unqTAiD
-----END PRIVATE KEY-----`;

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

  describe("[unit|cdp-auth]: generateCdpHeaders", () => {
    test("[generateCdpHeaders|success] - returns Authorization and Content-Type headers", async () => {
      const options: GenerateCdpHeadersOptions = {
        apiKeyId: "test-key-id",
        apiKeySecret: TEST_EC_KEY,
        requestMethod: "POST",
        requestPath: "/verify",
      };
      const headers = await generateCdpHeaders(options);

      expect(headers["Authorization"]).toMatch(/^Bearer /);
      expect(headers["Content-Type"]).toBe("application/json");
    });

    test("[generateCdpHeaders|success] - JWT uris reflect the given method and path", async () => {
      const headers = await generateCdpHeaders({
        apiKeyId: "test-key-id",
        apiKeySecret: TEST_EC_KEY,
        requestMethod: "POST",
        requestPath: "/settle",
      });

      const token = headers["Authorization"]!.replace("Bearer ", "");
      const parts = token.split(".");
      const payload = JSON.parse(
        Buffer.from(parts[1]!, "base64url").toString(),
      );
      expect(payload.uris[0]).toBe(
        "POST api.cdp.coinbase.com/settle",
      );
    });

    test("[generateCdpHeaders|success] - respects custom expiresIn via credentials", async () => {
      const headers = await generateCdpHeaders({
        apiKeyId: "test-key-id",
        apiKeySecret: TEST_EC_KEY,
        requestMethod: "POST",
        requestPath: "/verify",
        expiresIn: 60,
      });

      const token = headers["Authorization"]!.replace("Bearer ", "");
      const parts = token.split(".");
      const payload = JSON.parse(
        Buffer.from(parts[1]!, "base64url").toString(),
      );
      expect(payload.exp - payload.iat).toBeLessThanOrEqual(60);
    });
  });
});
