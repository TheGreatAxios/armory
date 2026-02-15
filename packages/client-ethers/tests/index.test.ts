/**
 * X-402 Ethers Client Tests
 */

import { describe, test, expect, mock, beforeEach } from "bun:test";
import { createX402Transport } from "../src/transport";
import {
  createX402V1Payment,
  createX402V2Payment,
  createPaymentPayload,
  parsePaymentRequirements,
  parsePaymentRequired,
  detectProtocolVersion
} from "../src/protocol";
import { PaymentError } from "../src/errors";
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

describe("[client-ethers]: parsePaymentRequired", () => {
  test("parses v2 requirements from header", () => {
    const v2Reqs = {
      x402Version: 2,
      resource: "https://api.example.com/data",
      accepts: [{
        to: "0x1234567890123456789012345678901234567890",
        amount: "1.0",
        network: "eip155:1",
        asset: "eip155:1/erc20:0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
        nonce: "123",
        expiry: Math.floor(Date.now() / 1000) + 3600,
      }]
    };

    const mockResponse = {
      headers: {
        get: mock((name: string) => {
          if (name === "PAYMENT-REQUIRED") {
            return JSON.stringify(v2Reqs);
          }
          return null;
        }),
      },
      json: mock(async () => v2Reqs),
    } as unknown as Response;

    const parsed = parsePaymentRequired(mockResponse);
    expect(parsed.version).toBe(2);
    expect(parsed.requirements).toEqual(v2Reqs.accepts[0]);
  });

  test("throws error when no requirements found", () => {
    const mockResponse = {
      headers: {
        get: mock(() => null),
      },
    } as unknown as Response;

    expect(() => parsePaymentRequired(mockResponse)).toThrow(PaymentError);
  });
});
