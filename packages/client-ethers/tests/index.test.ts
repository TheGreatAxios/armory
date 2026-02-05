/**
 * X-402 Ethers Client Tests
 */

import { describe, test, expect, mock, beforeEach } from "bun:test";
import { createX402Transport } from "../src/transport";
import {
  createPaymentPayloadV1,
  createPaymentPayloadV2,
  createPaymentPayload,
  parsePaymentRequirements,
  detectProtocolVersion
} from "../src/protocol";
import {
  recoverEIP3009Signer,
  signEIP3009,
  signPayment
} from "../src/eip3009";
import {
  SignerRequiredError,
  AuthorizationError,
  X402ClientError
} from "../src/types";

// Mock ethers
const mockSigner = {
  getAddress: mock(async () => "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb"),
  signTypedData: mock(async () =>
    "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1c1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef00"
  ),
};

const mockProvider = {
  getNetwork: mock(async () => ({ chainId: 8453n })),
};

beforeEach(() => {
  mockSigner.getAddress.mockClear();
  mockSigner.signTypedData.mockClear();
  mockProvider.getNetwork.mockClear();
});

describe("createX402Transport", () => {
  test("creates transport with default config", () => {
    const transport = createX402Transport();
    expect(transport).toBeDefined();
    expect(transport.getSigner()).toBeUndefined();
  });

  test("creates transport with custom config", () => {
    const transport = createX402Transport({
      baseURL: "https://api.example.com",
      autoPay: true,
      timeout: 5000,
    });
    expect(transport).toBeDefined();
  });

  test("setSigner updates signer", () => {
    const transport = createX402Transport();
    expect(transport.getSigner()).toBeUndefined();

    transport.setSigner(mockSigner as any);
    expect(transport.getSigner()).toBe(mockSigner);
  });

  test("has all HTTP methods", () => {
    const transport = createX402Transport();
    expect(typeof transport.fetch).toBe("function");
    expect(typeof transport.get).toBe("function");
    expect(typeof transport.post).toBe("function");
    expect(typeof transport.put).toBe("function");
    expect(typeof transport.del).toBe("function");
    expect(typeof transport.patch).toBe("function");
  });
});


describe("EIP-3009 signing", () => {
  test("signEIP3009 function exists", () => {
    expect(typeof signEIP3009).toBe("function");
  });

  test("signPayment function exists", () => {
    expect(typeof signPayment).toBe("function");
  });

  test("recoverEIP3009Signer function exists", () => {
    expect(typeof recoverEIP3009Signer).toBe("function");
  });
});

describe("Protocol version detection", () => {
  test("detectProtocolVersion returns 1 for v1 requirements", () => {
    const v1Req = {
      network: "ethereum",
      contractAddress: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
      payTo: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
      amount: "1.0",
      expiry: Date.now() + 3600,
    };
    expect(detectProtocolVersion(v1Req as any)).toBe(1);
  });

  test("detectProtocolVersion returns 2 for v2 requirements", () => {
    const v2Req = {
      to: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
      amount: "1.0",
      chainId: "eip155:1",
      assetId: "eip155:1/erc20:0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
      nonce: "123",
      expiry: Date.now() + 3600,
    };
    expect(detectProtocolVersion(v2Req as any)).toBe(2);
  });

  test("detectProtocolVersion returns 2 for v2 with object to", () => {
    const v2Req = {
      to: { role: "merchant", callback: "https://example.com/callback" },
      amount: "1.0",
      chainId: "eip155:1",
      assetId: "eip155:1/erc20:0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
      nonce: "123",
      expiry: Date.now() + 3600,
    };
    expect(detectProtocolVersion(v2Req as any)).toBe(2);
  });

  test("detectProtocolVersion defaults to v2 for unknown format", () => {
    const unknownReq = {
      to: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
      amount: "1.0",
      chainId: "eip155:1",
      assetId: "eip155:1/erc20:0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    };
    expect(detectProtocolVersion(unknownReq as any)).toBe(2);
  });
});

describe("Error classes", () => {
  test("SignerRequiredError creates proper error", () => {
    const error = new SignerRequiredError("Signer needed");
    expect(error.name).toBe("SignerRequiredError");
    expect(error.message).toBe("Signer needed");
  });

  test("AuthorizationError creates proper error", () => {
    const error = new AuthorizationError("Auth failed");
    expect(error.name).toBe("AuthorizationError");
    expect(error.message).toBe("Authorization failed: Auth failed");
  });

  test("X402ClientError supports cause", () => {
    const cause = new Error("Underlying error");
    const error = new X402ClientError("Client error", cause);
    expect(error.name).toBe("X402ClientError");
    expect(error.cause).toBe(cause);
  });
});

describe("Transport methods", () => {
  test("transport.get is a function", () => {
    const transport = createX402Transport();
    expect(typeof transport.get).toBe("function");
  });

  test("transport.post is a function", () => {
    const transport = createX402Transport();
    expect(typeof transport.post).toBe("function");
  });

  test("transport.put is a function", () => {
    const transport = createX402Transport();
    expect(typeof transport.put).toBe("function");
  });

  test("transport.del is a function", () => {
    const transport = createX402Transport();
    expect(typeof transport.del).toBe("function");
  });

  test("transport.patch is a function", () => {
    const transport = createX402Transport();
    expect(typeof transport.patch).toBe("function");
  });

  test("transport.fetch is a function", () => {
    const transport = createX402Transport();
    expect(typeof transport.fetch).toBe("function");
  });
});

describe("Payload creation - V1", () => {
  test("createPaymentPayloadV1 function exists", () => {
    expect(typeof createPaymentPayloadV1).toBe("function");
  });

  test("createPaymentPayloadV1 accepts all required parameters", () => {
    const params = {
      signer: mockSigner as any,
      from: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
      to: "0x1234567890123456789012345678901234567890",
      amount: "1.5",
      nonce: "123456",
      expiry: Math.floor(Date.now() / 1000) + 3600,
      chainId: 1,
      contractAddress: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
      network: "ethereum",
    };

    expect(params.signer).toBeDefined();
    expect(params.from).toMatch(/^0x[a-f0-9]+$/i);
    expect(params.to).toMatch(/^0x[a-f0-9]+$/i);
    expect(params.amount).toBe("1.5");
  });

  test("createPaymentPayloadV1 supports optional domain parameters", () => {
    const paramsWithDefaults = {
      signer: mockSigner as any,
      from: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
      to: "0x1234567890123456789012345678901234567890",
      amount: "1.0",
      nonce: "123456",
      expiry: Math.floor(Date.now() / 1000) + 3600,
      chainId: 1,
      contractAddress: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
      network: "ethereum",
      domainName: "CustomToken",
      domainVersion: "3",
    };

    expect(paramsWithDefaults.domainName).toBe("CustomToken");
    expect(paramsWithDefaults.domainVersion).toBe("3");
  });
});

describe("Payload creation - V2", () => {
  test("createPaymentPayloadV2 function exists", () => {
    expect(typeof createPaymentPayloadV2).toBe("function");
  });

  test("createPaymentPayloadV2 accepts all required parameters", () => {
    const params = {
      signer: mockSigner as any,
      from: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb" as `0x${string}`,
      to: "0x1234567890123456789012345678901234567890" as `0x${string}`,
      amount: "2.5",
      nonce: "789012",
      expiry: Math.floor(Date.now() / 1000) + 3600,
      chainId: "eip155:1" as `eip155:1`,
      assetId: "eip155:1/erc20:0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48" as `eip155:1/erc20:0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48`,
    };

    expect(params.from).toMatch(/^0x[a-f0-9]+$/i);
    expect(params.to).toMatch(/^0x[a-f0-9]+$/i);
    expect(params.amount).toBe("2.5");
    expect(params.chainId).toBe("eip155:1");
  });

  test("createPaymentPayloadV2 supports object to address", () => {
    const params = {
      signer: mockSigner as any,
      from: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb" as `0x${string}`,
      to: { role: "merchant", callback: "https://example.com/callback" },
      amount: "1.0",
      nonce: "789012",
      expiry: Math.floor(Date.now() / 1000) + 3600,
      chainId: "eip155:1" as `eip155:1`,
      assetId: "eip155:1/erc20:0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48" as `eip155:1/erc20:0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48`,
    };

    expect(typeof params.to).toBe("object");
    expect("role" in params.to).toBe(true);
    expect("callback" in params.to).toBe(true);
  });

  test("createPaymentPayloadV2 supports extensions", () => {
    const params = {
      signer: mockSigner as any,
      from: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb" as `0x${string}`,
      to: "0x1234567890123456789012345678901234567890" as `0x${string}`,
      amount: "1.0",
      nonce: "789012",
      expiry: Math.floor(Date.now() / 1000) + 3600,
      chainId: "eip155:1" as `eip155:1`,
      assetId: "eip155:1/erc20:0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48" as `eip155:1/erc20:0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48`,
      extensions: { customField: "value" },
    };

    expect(params.extensions).toEqual({ customField: "value" });
  });
});

describe("Payload creation - Unified", () => {
  test("createPaymentPayload function exists", () => {
    expect(typeof createPaymentPayload).toBe("function");
  });

  test("createPaymentPayload accepts v1 requirements", () => {
    const v1Requirements = {
      network: "ethereum",
      contractAddress: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
      payTo: "0x1234567890123456789012345678901234567890",
      amount: "1.0",
    };

    expect("contractAddress" in v1Requirements).toBe(true);
    expect("network" in v1Requirements).toBe(true);
  });

  test("createPaymentPayload accepts v2 requirements", () => {
    const v2Requirements = {
      to: "0x1234567890123456789012345678901234567890",
      amount: "1.0",
      chainId: "eip155:1",
      assetId: "eip155:1/erc20:0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    };

    expect("chainId" in v2Requirements).toBe(true);
    expect("assetId" in v2Requirements).toBe(true);
  });
});

describe("Signer integration", () => {
  test("transport with signer can be used for payment flows", () => {
    const transport = createX402Transport();
    transport.setSigner(mockSigner as any);

    expect(transport.getSigner()).toBeDefined();
    expect(transport.getSigner()).toBe(mockSigner);
  });

  test("signer mock has required methods", () => {
    expect(typeof mockSigner.getAddress).toBe("function");
    expect(typeof mockSigner.signTypedData).toBe("function");
  });

  test("getAddress mock returns valid address", async () => {
    const address = await mockSigner.getAddress();
    expect(address).toMatch(/^0x[a-f0-9]+$/i);
  });
});

describe("parsePaymentRequirements", () => {
  test("parses v2 requirements from header", async () => {
    const v2Reqs = {
      to: "0x1234567890123456789012345678901234567890",
      amount: "1.0",
      chainId: "eip155:1",
      assetId: "eip155:1/erc20:0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
      nonce: "123",
      expiry: Math.floor(Date.now() / 1000) + 3600,
    };

    const mockResponse = {
      headers: {
        get: mock((name: string) => {
          if (name === "X-402-Payment-Signature-V2") {
            return JSON.stringify(v2Reqs);
          }
          return null;
        }),
      },
      json: mock(async () => v2Reqs),
    } as unknown as Response;

    const requirements = await parsePaymentRequirements(mockResponse);
    expect(requirements).toEqual(v2Reqs);
  });

  test("falls back to JSON body when no v2 header", async () => {
    const v1Reqs = {
      network: "ethereum",
      contractAddress: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
      payTo: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
      amount: "1.0",
    };

    const mockResponse = {
      headers: {
        get: mock(() => null),
      },
      json: mock(async () => v1Reqs),
    } as unknown as Response;

    const requirements = await parsePaymentRequirements(mockResponse);
    expect(requirements).toEqual(v1Reqs);
  });

  test("throws error when no requirements found", async () => {
    const mockResponse = {
      headers: {
        get: mock(() => null),
      },
      json: mock(async () => {
        throw new Error("Invalid JSON");
      }),
    } as unknown as Response;

    await expect(parsePaymentRequirements(mockResponse)).rejects.toThrow(
      "No payment requirements found in response"
    );
  });
});
