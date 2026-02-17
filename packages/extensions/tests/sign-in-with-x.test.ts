import { describe, expect, test } from "bun:test";
import type { Address } from "@armory-sh/base";
import {
  createSIWxMessage,
  createSIWxPayload,
  declareSIWxExtension,
  encodeSIWxHeader,
  isSIWxExtension,
  parseSIWxHeader,
  SIGN_IN_WITH_X,
  validateSIWxMessage,
} from "../src/sign-in-with-x";

describe("[unit|extensions]: Sign-In-With-X Extension", () => {
  describe("[unit|extensions]: declareSIWxExtension", () => {
    test("[declareSIWxExtension|success] - creates extension with no config", () => {
      const extension = declareSIWxExtension();

      expect(extension).toBeDefined();
      expect(extension.info).toBeDefined();
      expect(typeof extension.info).toBe("object");
    });

    test("[declareSIWxExtension|success] - creates extension with domain", () => {
      const extension = declareSIWxExtension({
        domain: "example.com",
      });

      expect(extension.info.domain).toBe("example.com");
    });

    test("[declareSIWxExtension|success] - creates extension with resource URI", () => {
      const extension = declareSIWxExtension({
        resourceUri: "https://api.example.com/resource",
      });

      expect(extension.info.resourceUri).toBe(
        "https://api.example.com/resource",
      );
    });

    test("[declareSIWxExtension|success] - creates extension with network", () => {
      const extension = declareSIWxExtension({
        network: "eip155:8453",
      });

      expect(extension.info.network).toBe("eip155:8453");
    });

    test("[declareSIWxExtension|success] - creates extension with full config", () => {
      const config = {
        domain: "example.com",
        resourceUri: "https://api.example.com/resource",
        network: ["eip155:8453", "eip155:1"],
        statement: "Please sign in to access the API",
        version: "1",
        expirationSeconds: 3600,
      };

      const extension = declareSIWxExtension(config);

      expect(extension.info.domain).toBe(config.domain);
      expect(extension.info.resourceUri).toBe(config.resourceUri);
      expect(extension.info.network).toEqual(config.network);
      expect(extension.info.statement).toBe(config.statement);
      expect(extension.info.version).toBe(config.version);
      expect(extension.info.expirationSeconds).toBe(config.expirationSeconds);
    });
  });

  describe("[unit|extensions]: isSIWxExtension", () => {
    test("[isSIWxExtension|success] - identifies SIWX extension", () => {
      const extension = declareSIWxExtension();

      expect(isSIWxExtension(extension)).toBe(true);
    });

    test("[isSIWxExtension|error] - rejects non-objects", () => {
      expect(isSIWxExtension(null)).toBe(false);
      expect(isSIWxExtension(undefined)).toBe(false);
      expect(isSIWxExtension("string")).toBe(false);
      expect(isSIWxExtension(123)).toBe(false);
    });
  });

  describe("[unit|extensions]: createSIWxPayload", () => {
    test("[createSIWxPayload|success] - creates minimal payload", () => {
      const serverInfo = {
        domain: "example.com",
      };

      const payload = createSIWxPayload(
        serverInfo,
        "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1" as Address,
      );

      expect(payload.domain).toBe("example.com");
      expect(payload.address).toBe(
        "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1",
      );
      expect(payload.statement).toBeUndefined();
    });

    test("[createSIWxPayload|success] - creates full payload", () => {
      const serverInfo = {
        domain: "example.com",
        resourceUri: "https://api.example.com/resource",
        network: "eip155:8453",
        statement: "Please sign in",
        version: "1",
        expirationSeconds: 3600,
      };

      const now = new Date();
      const nonce = "test-nonce-123";

      const payload = createSIWxPayload(
        serverInfo,
        "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1" as Address,
        {
          nonce,
          issuedAt: now.toISOString(),
          expirationTime: new Date(now.getTime() + 3600 * 1000).toISOString(),
        },
      );

      expect(payload.domain).toBe("example.com");
      expect(payload.resourceUri).toBe("https://api.example.com/resource");
      expect(payload.chainId).toBe("eip155:8453");
      expect(payload.statement).toBe("Please sign in");
      expect(payload.version).toBe("1");
      expect(payload.nonce).toBe(nonce);
    });
  });

  describe("[unit|extensions]: createSIWxMessage", () => {
    test("[createSIWxMessage|success] - creates message from minimal payload", () => {
      const payload = {
        domain: "example.com",
        address: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1" as Address,
      };

      const message = createSIWxMessage(payload);

      expect(message).toContain("example.com wants you to sign in");
      expect(message).toContain(
        "Address: 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1",
      );
    });

    test("[createSIWxMessage|success] - creates message with statement", () => {
      const payload = {
        domain: "example.com",
        address: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1" as Address,
        statement: "Please sign in to access our API",
      };

      const message = createSIWxMessage(payload);

      expect(message).toContain("example.com wants you to sign in");
      expect(message).toContain("Please sign in to access our API");
    });

    test("[createSIWxMessage|success] - creates message with all fields", () => {
      const now = new Date();
      const expiration = new Date(now.getTime() + 3600 * 1000);

      const payload = {
        domain: "example.com",
        address: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1" as Address,
        resourceUri: "https://api.example.com/resource",
        statement: "Please sign in",
        version: "1",
        nonce: "test-nonce",
        issuedAt: now.toISOString(),
        expirationTime: expiration.toISOString(),
        chainId: "eip155:8453",
      };

      const message = createSIWxMessage(payload);

      expect(message).toContain("example.com wants you to sign in");
      expect(message).toContain("Please sign in");
      expect(message).toContain("URI: https://api.example.com/resource");
      expect(message).toContain("Version: 1");
      expect(message).toContain("Nonce: test-nonce");
      expect(message).toContain("Chain ID(s): eip155:8453");
    });
  });

  describe("[unit|extensions]: encodeSIWxHeader and parseSIWxHeader", () => {
    test("[encodeSIWxHeader|success] - encodes payload to header", () => {
      const payload = {
        domain: "example.com",
        address: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1" as Address,
      };

      const header = encodeSIWxHeader(payload);

      expect(header).toMatch(/^siwx-v1-[a-zA-Z0-9_-]+$/);
    });

    test("[parseSIWxHeader|success] - decodes valid header", () => {
      const payload = {
        domain: "example.com",
        address: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1" as Address,
        statement: "Please sign in",
      };

      const header = encodeSIWxHeader(payload);
      const decoded = parseSIWxHeader(header);

      expect(decoded.domain).toBe("example.com");
      expect(decoded.address).toBe(
        "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1",
      );
      expect(decoded.statement).toBe("Please sign in");
    });

    test("[parseSIWxHeader|error] - throws on invalid format", () => {
      expect(() => parseSIWxHeader("invalid-header")).toThrow();
      expect(() => parseSIWxHeader("siwx-v2-abc")).toThrow();
    });
  });

  describe("[unit|extensions]: validateSIWxMessage", () => {
    test("[validateSIWxMessage|success] - validates minimal valid payload", () => {
      const payload = {
        domain: "example.com",
        address: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1" as Address,
      };

      const result = validateSIWxMessage(
        payload,
        "https://api.example.com/resource",
      );

      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    test("[validateSIWxMessage|success] - validates payload with expiration", () => {
      const future = new Date(Date.now() + 3600 * 1000);

      const payload = {
        domain: "example.com",
        address: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1" as Address,
        expirationTime: future.toISOString(),
      };

      const result = validateSIWxMessage(
        payload,
        "https://api.example.com/resource",
      );

      expect(result.valid).toBe(true);
    });

    test("[validateSIWxMessage|error] - rejects missing domain", () => {
      const payload = {
        address: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1" as Address,
      } as any;

      const result = validateSIWxMessage(
        payload,
        "https://api.example.com/resource",
      );

      expect(result.valid).toBe(false);
      expect(result.error).toBe("Missing domain");
    });

    test("[validateSIWxMessage|error] - rejects invalid address", () => {
      const payload = {
        domain: "example.com",
        address: "not-an-address" as Address,
      };

      const result = validateSIWxMessage(
        payload,
        "https://api.example.com/resource",
      );

      expect(result.valid).toBe(false);
      expect(result.error).toBe("Invalid or missing address");
    });

    test("[validateSIWxMessage|error] - rejects expired message", () => {
      const past = new Date(Date.now() - 1000);

      const payload = {
        domain: "example.com",
        address: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1" as Address,
        expirationTime: past.toISOString(),
      };

      const result = validateSIWxMessage(
        payload,
        "https://api.example.com/resource",
      );

      expect(result.valid).toBe(false);
      expect(result.error).toBe("Message has expired");
    });

    test("[validateSIWxMessage|error] - rejects URI mismatch", () => {
      const payload = {
        domain: "example.com",
        address: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1" as Address,
        resourceUri: "https://different.com/resource",
      };

      const result = validateSIWxMessage(
        payload,
        "https://api.example.com/resource",
      );

      expect(result.valid).toBe(false);
      expect(result.error).toBe("Resource URI mismatch");
    });
  });

  describe("[unit|extensions]: SIGN_IN_WITH_X constant", () => {
    test("[SIGN_IN_WITH_X|success] - exports correct constant", () => {
      expect(SIGN_IN_WITH_X).toBe("sign-in-with-x");
    });
  });
});
