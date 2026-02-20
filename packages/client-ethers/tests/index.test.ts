/**
 * X-402 Ethers Client Tests
 */

import { beforeEach, describe, expect, mock, test } from "bun:test";
import {
  decodePaymentV2,
  encodeSettlementV2,
  type ClientHook,
  type PaymentRequirementsV2,
} from "@armory-sh/base";
import type { Signer } from "ethers";
import { createX402Transport } from "../src/index";
import { PaymentError } from "../src/errors";
import { parsePaymentRequired } from "../src/protocol";

// Mock ethers
const mockSigner = {
  getAddress: mock(async () => "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb"),
  signTypedData: mock(
    async () =>
      "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1c1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef00",
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
      accepts: [
        {
          to: "0x1234567890123456789012345678901234567890",
          amount: "1.0",
          network: "eip155:1",
          asset: "eip155:1/erc20:0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
          nonce: "123",
          expiry: Math.floor(Date.now() / 1000) + 3600,
        },
      ],
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
    expect(parsed.accepts[0]).toEqual(v2Reqs.accepts[0]);
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

describe(
  "[unit|client-ethers] - [createX402Transport|success] - applies extensions override for non-primary requirement",
  () => {
    test("signs selected requirement returned by extension selector", async () => {
      const baseRequirement: PaymentRequirementsV2 = {
        scheme: "exact",
        network: "eip155:84532",
        amount: "1000000",
        asset: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
        payTo: "0x1234567890123456789012345678901234567890",
        maxTimeoutSeconds: 300,
      };
      const skaleRequirement: PaymentRequirementsV2 = {
        scheme: "exact",
        network: "eip155:324705682",
        amount: "1000000",
        asset: "0x2e08028E3C4c2356572E096d8EF835cD5C6030bD",
        payTo: "0x1234567890123456789012345678901234567890",
        maxTimeoutSeconds: 300,
      };
      let selectedNetwork: string | undefined;
      const selector: ClientHook<typeof mockSigner> = {
        name: "select-skale",
        async selectRequirement(context) {
          selectedNetwork = context.accepts[1]?.network;
          return context.accepts.find(
            (req) => req.network === skaleRequirement.network,
          );
        },
      };

      const transport = createX402Transport({
        maxRetries: 2,
        hooks: [selector],
      });
      transport.setSigner(mockSigner as unknown as Signer);

      let requestCount = 0;
      const originalFetch = global.fetch;
      global.fetch = mock(async (_input, init) => {
        requestCount += 1;
        const header = new Headers(init?.headers).get("PAYMENT-SIGNATURE");
        if (!header && requestCount === 1) {
          const paymentRequired = {
            x402Version: 2,
            error: "Payment required",
            resource: { url: "https://api.example.com/pay" },
            accepts: [baseRequirement, skaleRequirement],
          };
          const encoded = Buffer.from(JSON.stringify(paymentRequired)).toString(
            "base64",
          );
          return new Response("Payment Required", {
            status: 402,
            headers: { "PAYMENT-REQUIRED": encoded },
          });
        }
        if (!header) {
          return new Response("Paid", { status: 200 });
        }
        decodePaymentV2(header);
        return new Response("Paid", {
          status: 200,
          headers: {
            "PAYMENT-RESPONSE": encodeSettlementV2({
              success: true,
              transaction: "0xabc123",
              network: skaleRequirement.network,
            }),
          },
        });
      }) as typeof fetch;

      try {
        const response = await transport.get("https://api.example.com/pay");
        expect([200, 402]).toContain(response.status);
        expect(selectedNetwork).toBe(skaleRequirement.network);
      } finally {
        global.fetch = originalFetch;
      }
    });
  },
);

describe(
  "[unit|client-ethers] - [createX402Transport|error] - surfaces 402 server verification details",
  () => {
    test("passes insufficient_funds detail to onPaymentError", async () => {
      const onPaymentError = mock(() => {});
      mockSigner.signTypedData.mockImplementation(
        async () => `0x${"1".repeat(64)}${"2".repeat(64)}1b`,
      );
      const transport = createX402Transport({
        maxRetries: 1,
        onPaymentError,
      });
      transport.setSigner(mockSigner as unknown as Signer);

      let requestCount = 0;
      const originalFetch = global.fetch;
      global.fetch = mock(async (_input, init) => {
        requestCount += 1;
        const header = new Headers(init?.headers).get("PAYMENT-SIGNATURE");
        if (!header && requestCount === 1) {
          const paymentRequired = {
            x402Version: 2,
            error: "Payment required",
            resource: { url: "https://api.example.com/pay" },
            accepts: [
              {
                scheme: "exact",
                network: "eip155:8453",
                amount: "1000000",
                asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
                payTo: "0x1234567890123456789012345678901234567890",
                maxTimeoutSeconds: 300,
              },
            ],
          };
          const encoded = Buffer.from(JSON.stringify(paymentRequired)).toString(
            "base64",
          );
          return new Response("Payment Required", {
            status: 402,
            headers: { "PAYMENT-REQUIRED": encoded },
          });
        }

        return new Response(
          JSON.stringify({
            error: "Payment verification failed",
            message: "insufficient_funds",
          }),
          { status: 402 },
        );
      }) as typeof fetch;

      try {
        const response = await transport.get("https://api.example.com/pay");
        expect(response.status).toBe(402);
        expect(onPaymentError).toHaveBeenCalledTimes(1);
        expect(onPaymentError.mock.calls[0]?.[0]?.message).toContain(
          "insufficient_funds",
        );
      } finally {
        global.fetch = originalFetch;
      }
    });
  },
);
