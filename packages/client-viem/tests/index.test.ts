import { expect, mock, test } from "bun:test";
import {
  PaymentException as PaymentError,
  SigningError,
  V2_HEADERS,
} from "@armory-sh/base";
import type { Account } from "viem";
import { createX402Client, createX402Transport } from "../src/client";
import type { X402Wallet } from "../src/types";

const mockAccount: Account = {
  address: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0",
  signMessage: async () => "0x" as const,
  signTypedData: async () => `${"0x".padEnd(130, "a")}1b`,
  signTransaction: async () => "0x" as const,
};

const mockWallet: X402Wallet = {
  type: "account",
  account: mockAccount,
};

const USDC_BASE = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const PAYEE = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

function createMockPaymentRequired(
  overrides: Partial<{
    payTo: string;
    amount: string;
    network: string;
    asset: string;
    maxTimeoutSeconds: number;
  }> = {},
) {
  return JSON.stringify({
    x402Version: 2,
    resource: {
      url: "https://api.example.com/data",
      mimeType: "application/json",
    },
    accepts: [
      {
        scheme: "exact",
        payTo: overrides.payTo ?? PAYEE,
        amount: overrides.amount ?? "1000000",
        network: overrides.network ?? "eip155:8453",
        asset: overrides.asset ?? USDC_BASE,
        maxTimeoutSeconds: overrides.maxTimeoutSeconds ?? 300,
      },
    ],
  });
}

function encodeResponse(data: object) {
  return Buffer.from(JSON.stringify(data))
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

// ========================================
// Basic Client Creation Tests
// ========================================

test("createX402Client creates a client instance", () => {
  const client = createX402Client({ wallet: mockWallet });

  expect(client).toBeDefined();
  expect(client.getAddress()).toBe(mockAccount.address);
});

test("createX402Client with WalletClient type", () => {
  const mockWalletClient = {
    account: mockAccount,
    signTypedData: async () => `${"0x".padEnd(130, "a")}1b`,
  } as any;

  const client = createX402Client({
    wallet: { type: "walletClient", walletClient: mockWalletClient },
  });

  expect(client).toBeDefined();
  expect(client.getAddress()).toBe(mockAccount.address);
});

test("createX402Client with custom config", () => {
  const client = createX402Client({
    wallet: mockWallet,
    version: 1,
    defaultExpiry: 7200,
    debug: true,
  });

  expect(client).toBeDefined();
  expect(client.getAddress()).toBe(mockAccount.address);
});

// ========================================
// Payment Creation Tests
// ========================================

test("[unit|client-viem] - [createPayment|success] - generates v2 payment payload", async () => {
  const client = createX402Client({ wallet: mockWallet, version: 2 });

  const payment = await client.createPayment(
    "1500000", // 1.5 USDC in atomic units
    "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    8453,
  );

  expect(payment).toBeDefined();
  expect(payment).toHaveProperty("x402Version", 2);
  expect(payment).toHaveProperty("accepted");
  expect(payment).toHaveProperty("payload");
  expect(payment.payload).toHaveProperty("signature");
  expect(payment.payload).toHaveProperty("authorization");
});

test("createPayment generates v2 payment payload with explicit version", async () => {
  const client = createX402Client({ wallet: mockWallet, version: 2 });

  const payment = await client.createPayment(
    "1500000", // 1.5 USDC in atomic units
    "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    8453,
  );

  expect(payment).toBeDefined();
  expect(payment).toHaveProperty("x402Version", 2);
  expect(payment).toHaveProperty("accepted");
  expect(payment.accepted).toHaveProperty("scheme", "exact");
  expect(payment.accepted).toHaveProperty("network", "eip155:8453");
  expect(payment).toHaveProperty("payload");
  expect(payment.payload).toHaveProperty("signature");
  expect(payment.payload).toHaveProperty("authorization");
});

test("signPayment signs payload", async () => {
  const client = createX402Client({ wallet: mockWallet });

  const unsigned = {
    from: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0" as const,
    to: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as const,
    amount: "1000000", // 1 USDC in atomic units
    nonce: "1234567890",
    expiry: 1735718400,
    chainId: 8453,
    contractAddress: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as const,
    network: "base",
  };

  const signed = await client.signPayment(unsigned);

  expect(signed).toBeDefined();
  expect(signed).toHaveProperty("x402Version", 2);
  expect(signed).toHaveProperty("payload");
  expect(signed.payload).toHaveProperty("signature");
  expect(signed.payload).toHaveProperty("authorization");
  expect(signed.payload.authorization).toHaveProperty(
    "nonce",
    "0x00000000000000000000000000000000000000000000000000000000499602d2",
  );
});

test("nonceGenerator is used for payments", async () => {
  const customNonce = () => "1234567890";

  const client = createX402Client({
    wallet: mockWallet,
    nonceGenerator: customNonce,
  });

  const payment = await client.createPayment(
    "1000000", // 1 USDC in atomic units
    "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    8453,
  );

  // Nonce is in the authorization, nested in payload
  expect(payment).toHaveProperty("payload");
  expect(payment.payload).toHaveProperty("authorization");
  expect(payment.payload.authorization).toHaveProperty("nonce");
});

// ========================================
// Fetch & Payment Flow Tests
// ========================================

test("fetch handles 402 response with payment", async () => {
  const client = createX402Client({ wallet: mockWallet });

  let callCount = 0;
  global.fetch = mock(() => {
    callCount++;
    if (callCount === 1) {
      const encoded = Buffer.from(createMockPaymentRequired()).toString(
        "base64",
      );
      return Promise.resolve(
        new Response("Payment Required", {
          status: 402,
          headers: { "PAYMENT-REQUIRED": encoded },
        }),
      );
    }
    return Promise.resolve(
      new Response("Success", {
        status: 200,
        headers: {
          "PAYMENT-RESPONSE": encodeResponse({
            success: true,
            transaction: "0xabc123",
            network: "eip155:8453",
          }),
        },
      }),
    );
  });

  const response = await client.fetch("https://api.example.com/data");

  expect(response.status).toBe(200);
  expect(callCount).toBe(2);
});

test("[unit|client-viem] - [fetch|success] - uses url-safe payment header encoding", async () => {
  const client = createX402Client({ wallet: mockWallet });
  const capturedHeaders: string[] = [];

  let callCount = 0;
  global.fetch = mock((_input, init) => {
    callCount += 1;
    if (callCount === 1) {
      const encoded = Buffer.from(createMockPaymentRequired()).toString(
        "base64",
      );
      return Promise.resolve(
        new Response("Payment Required", {
          status: 402,
          headers: { [V2_HEADERS.PAYMENT_REQUIRED]: encoded },
        }),
      );
    }

    const headerValue = new Headers(init?.headers).get(
      V2_HEADERS.PAYMENT_SIGNATURE,
    );
    capturedHeaders.push(headerValue ?? "");
    return Promise.resolve(
      new Response("Success", {
        status: 200,
        headers: {
          [V2_HEADERS.PAYMENT_RESPONSE]: encodeResponse({
            success: true,
            transaction: "0xabc123",
            network: "eip155:8453",
          }),
        },
      }),
    );
  });

  const response = await client.fetch("https://api.example.com/data");

  expect(response.status).toBe(200);
  expect(capturedHeaders.length).toBe(1);
  expect(capturedHeaders[0].includes("+")).toBe(false);
  expect(capturedHeaders[0].includes("/")).toBe(false);
  expect(capturedHeaders[0].includes("=")).toBe(false);
});

test("[unit|client-viem] - [fetch|success] - uses requirement domain metadata for signing", async () => {
  let capturedDomainName: string | undefined;
  let capturedDomainVersion: string | undefined;

  const domainAwareWallet: X402Wallet = {
    type: "account",
    account: {
      ...mockAccount,
      signTypedData: async (params) => {
        capturedDomainName = params.domain?.name;
        capturedDomainVersion = params.domain?.version;
        return `${"0x".padEnd(130, "a")}1b`;
      },
    },
  };

  const client = createX402Client({ wallet: domainAwareWallet });

  let callCount = 0;
  global.fetch = mock(() => {
    callCount += 1;
    if (callCount === 1) {
      const encoded = Buffer.from(
        JSON.stringify({
          x402Version: 2,
          resource: {
            url: "https://api.example.com/data",
            mimeType: "application/json",
          },
          accepts: [
            {
              scheme: "exact",
              payTo: PAYEE,
              amount: "1000000",
              network: "eip155:324705682",
              asset: "0x2e08028E3C4c2356572E096d8EF835cD5C6030bD",
              maxTimeoutSeconds: 300,
              extra: {
                name: "Bridged USDC (SKALE Bridge)",
                version: "2",
              },
            },
          ],
        }),
      ).toString("base64");

      return Promise.resolve(
        new Response("Payment Required", {
          status: 402,
          headers: { [V2_HEADERS.PAYMENT_REQUIRED]: encoded },
        }),
      );
    }

    return Promise.resolve(
      new Response("Success", {
        status: 200,
        headers: {
          [V2_HEADERS.PAYMENT_RESPONSE]: encodeResponse({
            success: true,
            transaction: "0xabc123",
            network: "eip155:324705682",
          }),
        },
      }),
    );
  });

  const response = await client.fetch("https://api.example.com/data");

  expect(response.status).toBe(200);
  expect(capturedDomainName).toBe("Bridged USDC (SKALE Bridge)");
  expect(capturedDomainVersion).toBe("2");
});

test("[unit|client-viem] - [fetch|success] - uses requirement maxTimeoutSeconds for validBefore", async () => {
  let capturedValidBefore: bigint | undefined;

  const timeoutAwareWallet: X402Wallet = {
    type: "account",
    account: {
      ...mockAccount,
      signTypedData: async (params) => {
        capturedValidBefore = params.message.validBefore;
        return `${"0x".padEnd(130, "a")}1b`;
      },
    },
  };

  const client = createX402Client({ wallet: timeoutAwareWallet });
  const start = Math.floor(Date.now() / 1000);

  let callCount = 0;
  global.fetch = mock(() => {
    callCount += 1;
    if (callCount === 1) {
      const encoded = Buffer.from(
        JSON.stringify({
          x402Version: 2,
          resource: {
            url: "https://api.example.com/data",
            mimeType: "application/json",
          },
          accepts: [
            {
              scheme: "exact",
              payTo: PAYEE,
              amount: "1000000",
              network: "eip155:8453",
              asset: USDC_BASE,
              maxTimeoutSeconds: 300,
            },
          ],
        }),
      ).toString("base64");

      return Promise.resolve(
        new Response("Payment Required", {
          status: 402,
          headers: { [V2_HEADERS.PAYMENT_REQUIRED]: encoded },
        }),
      );
    }

    return Promise.resolve(
      new Response("Success", {
        status: 200,
        headers: {
          [V2_HEADERS.PAYMENT_RESPONSE]: encodeResponse({
            success: true,
            transaction: "0xabc123",
            network: "eip155:8453",
          }),
        },
      }),
    );
  });

  const response = await client.fetch("https://api.example.com/data");
  const expectedMin = BigInt(start + 300);
  const expectedMax = BigInt(start + 302);

  expect(response.status).toBe(200);
  expect(capturedValidBefore).toBeDefined();
  expect(capturedValidBefore! >= expectedMin).toBe(true);
  expect(capturedValidBefore! <= expectedMax).toBe(true);
});

test("fetch handles 402 response with v2 payment", async () => {
  const client = createX402Client({ wallet: mockWallet, version: 2 });

  let callCount = 0;
  global.fetch = mock(() => {
    callCount++;
    if (callCount === 1) {
      const encoded = Buffer.from(createMockPaymentRequired()).toString(
        "base64",
      );
      return Promise.resolve(
        new Response("Payment Required", {
          status: 402,
          headers: { "PAYMENT-REQUIRED": encoded },
        }),
      );
    }
    return Promise.resolve(
      new Response("Success", {
        status: 200,
        headers: {
          "PAYMENT-RESPONSE": encodeResponse({
            success: true,
            transaction: "0xabc123",
            network: "eip155:8453",
          }),
        },
      }),
    );
  });

  const response = await client.fetch("https://api.example.com/data");

  expect(response.status).toBe(200);
  expect(callCount).toBe(2);
});

test("fetch passes through non-402 responses", async () => {
  const client = createX402Client({ wallet: mockWallet });

  global.fetch = mock(() =>
    Promise.resolve(new Response("OK", { status: 200 })),
  );

  const response = await client.fetch("https://api.example.com/data");

  expect(response.status).toBe(200);
});

test("createX402Transport returns fetch function", () => {
  const transport = createX402Transport({
    wallet: mockWallet,
  });

  expect(typeof transport).toBe("function");
});

// ========================================
// Enhanced Client Creation Tests
// ========================================

test("creates client with Account type wallet", () => {
  const account: Account = {
    address: "0x1234567890123456789012345678901234567890" as const,
    signMessage: async () => "0x" as const,
    signTypedData: async () => `${"0x".padEnd(130, "a")}1b`,
    signTransaction: async () => "0x" as const,
  };

  const wallet: X402Wallet = { type: "account", account };
  const client = createX402Client({ wallet });

  expect(client).toBeDefined();
  expect(client.getAddress()).toBe(account.address);
});

test("creates client with WalletClient type wallet", () => {
  const walletClient = {
    account: {
      address: "0x9876543210987654321098765432109876543210" as const,
    },
    signTypedData: async () => `${"0x".padEnd(130, "a")}1b`,
  };

  const wallet: X402Wallet = {
    type: "walletClient",
    walletClient: walletClient as any,
  };
  const client = createX402Client({ wallet });

  expect(client).toBeDefined();
  expect(client.getAddress()).toBe(walletClient.account.address);
});

test("creates client with token configuration", () => {
  const token = {
    name: "TestToken",
    version: "1.0.0",
    chainId: 8453,
    address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as const,
    decimals: 6,
    symbol: "TEST",
  };

  const client = createX402Client({ wallet: mockWallet, token });

  expect(client).toBeDefined();
  expect(client.getAddress()).toBe(mockAccount.address);
});

test("creates client with domain name and version overrides", () => {
  const client = createX402Client({
    wallet: mockWallet,
    domainName: "MyCustomDomain",
    domainVersion: "2.0.0",
  });

  expect(client).toBeDefined();
  expect(client.getAddress()).toBe(mockAccount.address);
});

test("creates client with auto version detection", () => {
  const client = createX402Client({
    wallet: mockWallet,
    version: "auto",
  });

  expect(client).toBeDefined();
  expect(client.getAddress()).toBe(mockAccount.address);
});

// ========================================
// Payment Flow with Mocked Responses
// ========================================

test("full payment flow: 402 -> payment -> success", async () => {
  const client = createX402Client({ wallet: mockWallet, debug: false });

  let callCount = 0;
  const mockFetch = mock(() => {
    callCount++;
    if (callCount === 1) {
      const encoded = Buffer.from(
        createMockPaymentRequired({ amount: "2500000" }),
      ).toString("base64");
      return Promise.resolve(
        new Response("Payment Required", {
          status: 402,
          headers: { "PAYMENT-REQUIRED": encoded },
        }),
      );
    }
    return Promise.resolve(
      new Response('{"data": "protected content"}', {
        status: 200,
        headers: {
          "PAYMENT-RESPONSE": encodeResponse({
            success: true,
            transaction: "0xtx123",
            network: "eip155:8453",
          }),
        },
      }),
    );
  });

  global.fetch = mockFetch;

  const response = await client.fetch("https://api.example.com/protected");

  expect(callCount).toBe(2);
  expect(response.status).toBe(200);
  const data = await response.json();
  expect(data).toEqual({ data: "protected content" });
});

test("payment flow with v2 protocol", async () => {
  const client = createX402Client({ wallet: mockWallet, version: 2 });

  let callCount = 0;
  const mockFetch = mock(() => {
    callCount++;
    if (callCount === 1) {
      const encoded = Buffer.from(createMockPaymentRequired()).toString(
        "base64",
      );
      return Promise.resolve(
        new Response("Payment Required", {
          status: 402,
          headers: { "PAYMENT-REQUIRED": encoded },
        }),
      );
    }
    return Promise.resolve(
      new Response('{"result": "success"}', {
        status: 200,
        headers: {
          "PAYMENT-RESPONSE": encodeResponse({
            success: true,
            transaction: "0xabc456",
            network: "eip155:8453",
          }),
        },
      }),
    );
  });

  global.fetch = mockFetch;

  const response = await client.fetch("https://api.example.com/v2/resource");

  expect(callCount).toBe(2);
  expect(response.status).toBe(200);
});

test("payment flow with custom expiry and nonce", async () => {
  const customNonce = "999888777";
  const customExpiry = Math.floor(Date.now() / 1000) + 7200;

  const client = createX402Client({
    wallet: mockWallet,
    defaultExpiry: 7200,
    nonceGenerator: () => customNonce,
  });

  const payment = await client.createPayment(
    "5000000", // 5 USDC in atomic units
    "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    8453,
    customExpiry,
  );

  expect(payment.payload.authorization.nonce).toBe(
    "0x000000000000000000000000000000000000000000000000000000003b991789",
  );
});

// ========================================
// Error Handling for Failed Payments
// ========================================

test("throws SigningError when account lacks signTypedData", async () => {
  const incompleteAccount = {
    address: "0x0000000000000000000000000000000000000001" as const,
    signMessage: async () => "0x" as const,
    signTransaction: async () => "0x" as const,
  };

  const wallet: X402Wallet = {
    type: "account",
    account: incompleteAccount as any,
  };
  const client = createX402Client({ wallet });

  let callCount = 0;
  global.fetch = mock(() => {
    callCount++;
    if (callCount === 1) {
      const encoded = Buffer.from(createMockPaymentRequired()).toString(
        "base64",
      );
      return Promise.resolve(
        new Response("Payment Required", {
          status: 402,
          headers: { "PAYMENT-REQUIRED": encoded },
        }),
      );
    }
    return Promise.resolve(new Response("OK", { status: 200 }));
  });

  await expect(
    client.fetch("https://api.example.com/test"),
  ).rejects.toThrowError(SigningError);
});

test("throws PaymentError on failed settlement", async () => {
  const client = createX402Client({ wallet: mockWallet });

  let callCount = 0;
  global.fetch = mock(() => {
    callCount++;
    if (callCount === 1) {
      const encoded = Buffer.from(createMockPaymentRequired()).toString(
        "base64",
      );
      return Promise.resolve(
        new Response("Payment Required", {
          status: 402,
          headers: { "PAYMENT-REQUIRED": encoded },
        }),
      );
    }
    return Promise.resolve(
      new Response("Payment Failed", {
        status: 402,
        headers: { "PAYMENT-RESPONSE": "invalid-json{{{" },
      }),
    );
  });

  await expect(
    client.fetch("https://api.example.com/expensive"),
  ).rejects.toThrow(PaymentError);
});

test("throws PaymentError on malformed payment requirements", async () => {
  const client = createX402Client({ wallet: mockWallet });

  global.fetch = mock(() =>
    Promise.resolve(
      new Response("Payment Required", {
        status: 402,
        headers: {
          "PAYMENT-REQUIRED": "not-valid-json{{{",
        },
      }),
    ),
  );

  await expect(
    client.fetch("https://api.example.com/bad-json"),
  ).rejects.toThrow("Failed to parse V2 PAYMENT-REQUIRED header");
});

test("throws PaymentError on invalid base64", async () => {
  const client = createX402Client({ wallet: mockWallet });

  global.fetch = mock(() =>
    Promise.resolve(
      new Response("Payment Required", {
        status: 402,
        headers: {
          "PAYMENT-REQUIRED": "invalid-base64!!!",
        },
      }),
    ),
  );

  await expect(
    client.fetch("https://api.example.com/malformed"),
  ).rejects.toThrow(PaymentError);
});

test("throws PaymentError on malformed v2 payment requirements", async () => {
  const client = createX402Client({ wallet: mockWallet, version: 2 });

  global.fetch = mock(() =>
    Promise.resolve(
      new Response("Payment Required", {
        status: 402,
        headers: {
          "PAYMENT-REQUIRED": "not-valid-json{{{",
        },
      }),
    ),
  );

  await expect(
    client.fetch("https://api.example.com/bad-json"),
  ).rejects.toThrowError(PaymentError);
});

test("handles network errors gracefully", async () => {
  const client = createX402Client({ wallet: mockWallet });

  global.fetch = mock(() =>
    Promise.reject(new Error("Network connection failed")),
  );

  await expect(
    client.fetch("https://api.example.com/network-error"),
  ).rejects.toThrow("Network connection failed");
});

test("PaymentError includes error details", async () => {
  const client = createX402Client({ wallet: mockWallet });

  let callCount = 0;
  global.fetch = mock(() => {
    callCount++;
    if (callCount === 1) {
      const paymentRequired = JSON.stringify({
        x402Version: 2,
        resource: "https://api.example.com/invalid-sig",
        accepts: [
          {
            scheme: "exact",
            payTo: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
            amount: "1000000",
            network: "eip155:8453",
            asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
            maxTimeoutSeconds: 300,
          },
        ],
      });
      const encoded = Buffer.from(paymentRequired).toString("base64");

      return Promise.resolve(
        new Response("Payment Required", {
          status: 402,
          headers: {
            "PAYMENT-REQUIRED": encoded,
          },
        }),
      );
    }
    return Promise.resolve(
      new Response("Payment Failed", {
        status: 402,
        headers: {
          "PAYMENT-RESPONSE": "invalid-json{{{",
        },
      }),
    );
  });

  try {
    await client.fetch("https://api.example.com/invalid-sig");
    expect.unreachable();
  } catch (error) {
    expect(error).toBeInstanceOf(PaymentError);
    expect((error as PaymentError).message).toContain(
      "Failed to decode settlement",
    );
  }
});
