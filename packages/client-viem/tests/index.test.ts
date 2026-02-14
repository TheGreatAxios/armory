import { test, expect, mock } from "bun:test";
import { createX402Client, createX402Transport } from "../src/client";
import { SigningError, PaymentError } from "../src/errors";
import type { X402Wallet } from "../src/types";
import type { Account } from "viem";

const mockAccount: Account = {
  address: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0",
  signMessage: async () => "0x" as const,
  signTypedData: async () => "0x".padEnd(130, "a") + "1b",
  signTransaction: async () => "0x" as const,
};

const mockWallet: X402Wallet = {
  type: "account",
  account: mockAccount,
};

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
    signTypedData: async () => "0x".padEnd(130, "a") + "1b",
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

test("createPayment generates v1 payment payload", async () => {
  const client = createX402Client({ wallet: mockWallet, version: 1 });

  const payment = await client.createPayment(
    "1.5",
    "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    8453
  );

  expect(payment).toBeDefined();
  // x402 V1 format has nested structure
  expect(payment).toHaveProperty("x402Version", 1);
  expect(payment).toHaveProperty("scheme");
  expect(payment).toHaveProperty("network");
  expect(payment).toHaveProperty("payload");
  expect(payment.payload).toHaveProperty("signature");
  expect(payment.payload).toHaveProperty("authorization");
});

test("createPayment generates v2 payment payload", async () => {
  const client = createX402Client({ wallet: mockWallet, version: 2 });

  const payment = await client.createPayment(
    "1.5",
    "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    8453
  );

  expect(payment).toBeDefined();
  // x402 V2 format
  expect(payment).toHaveProperty("x402Version", 2);
  expect(payment).toHaveProperty("scheme");
  expect(payment).toHaveProperty("payload");
  expect(payment.payload).toHaveProperty("signature");
  expect(payment.payload).toHaveProperty("authorization");
});

test("signPayment signs v1 payload", async () => {
  const client = createX402Client({ wallet: mockWallet, version: 1 });

  const unsigned = {
    from: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0" as const,
    to: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as const,
    amount: "1.0",
    nonce: "1234567890",
    expiry: 1735718400,
    chainId: 8453,
    contractAddress: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as const,
    network: "base",
  };

  const signed = await client.signPayment(unsigned);

  expect(signed).toBeDefined();
  // Returns x402 V1 format
  expect(signed).toHaveProperty("x402Version", 1);
  expect(signed).toHaveProperty("payload");
  expect(signed.payload).toHaveProperty("signature");
});

test("nonceGenerator is used for payments", async () => {
  const customNonce = () => "1234567890";

  const client = createX402Client({ wallet: mockWallet, nonceGenerator: customNonce });

  const payment = await client.createPayment(
    "1.0",
    "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    8453
  );

  // Nonce is in the authorization, nested in payload
  expect(payment).toHaveProperty("payload");
  expect(payment.payload).toHaveProperty("authorization");
  expect(payment.payload.authorization).toHaveProperty("nonce");
});

// ========================================
// Fetch & Payment Flow Tests
// ========================================

test("fetch handles 402 response with v1 payment", async () => {
  const client = createX402Client({ wallet: mockWallet, version: 1 });

  let callCount = 0;
  global.fetch = mock(() => {
    callCount++;
    if (callCount === 1) {
      return Promise.resolve(
        new Response("Payment Required", {
          status: 402,
          headers: {
            "X-PAYMENT-REQUIRED": Buffer.from(
              JSON.stringify({
                x402Version: 1,
                scheme: "exact",
                network: "base",
                accepts: [{
                  network: "base",
                  asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
                  payTo: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
                  maxAmountRequired: "1.0",
                  resource: "https://api.example.com/data",
                  description: "Test payment",
                  maxTimeoutSeconds: 3600,
                }]
              })
            ).toString("base64"),
          },
        })
      );
    }
    return Promise.resolve(
      new Response("Success", {
        status: 200,
        headers: {
          "X-PAYMENT-RESPONSE": Buffer.from(
            JSON.stringify({ success: true, network: "base", txHash: "0xabc123", timestamp: Date.now() })
          ).toString("base64"),
        },
      })
    );
  });

  const response = await client.fetch("https://api.example.com/data");

  expect(response.status).toBe(200);
  expect(callCount).toBe(2);
});

test("fetch handles 402 response with v2 payment", async () => {
  const client = createX402Client({ wallet: mockWallet, version: 2 });

  let callCount = 0;
  global.fetch = mock(() => {
    callCount++;
    if (callCount === 1) {
      // Base64 encode the PAYMENT-REQUIRED header (V2 format)
      const paymentRequired = JSON.stringify({
              x402Version: 2,
              resource: "https://api.example.com/data",
              accepts: [{
                to: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
                amount: "1.0",
                network: "eip155:8453",
                asset: "eip155:8453/erc20:0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
                nonce: `${Date.now()}`,
                expiry: 1735718400,
              }]
            });
      const encoded = Buffer.from(paymentRequired).toString("base64");

      return Promise.resolve(
        new Response("Payment Required", {
          status: 402,
          headers: {
            "PAYMENT-REQUIRED": encoded,
          },
        })
      );
    }
    return Promise.resolve(
      new Response("Success", {
        status: 200,
        headers: {
          "PAYMENT-RESPONSE": JSON.stringify({ status: "success", txHash: "0xabc123", timestamp: Date.now() }),
        },
      })
    );
  });

  const response = await client.fetch("https://api.example.com/data");

  expect(response.status).toBe(200);
  expect(callCount).toBe(2);
});

test("fetch passes through non-402 responses", async () => {
  const client = createX402Client({ wallet: mockWallet });

  global.fetch = mock(() => Promise.resolve(new Response("OK", { status: 200 })));

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
    signTypedData: async () => "0x".padEnd(130, "a") + "1b",
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
    signTypedData: async () => "0x".padEnd(130, "a") + "1b",
  };

  const wallet: X402Wallet = { type: "walletClient", walletClient: walletClient as any };
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
  const client = createX402Client({ wallet: mockWallet, version: 1, debug: false });

  let callCount = 0;
  const mockFetch = mock(() => {
    callCount++;
    if (callCount === 1) {
      return Promise.resolve(
        new Response("Payment Required", {
          status: 402,
          headers: {
            "X-PAYMENT-REQUIRED": Buffer.from(
              JSON.stringify({
                x402Version: 1,
                scheme: "exact",
                network: "base",
                accepts: [{
                  network: "base",
                  asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
                  payTo: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
                  maxAmountRequired: "2.5",
                  resource: "https://api.example.com/protected",
                  description: "Test resource",
                  maxTimeoutSeconds: 3600,
                }]
              })
            ).toString("base64"),
          },
        })
      );
    }
    return Promise.resolve(
      new Response('{"data": "protected content"}', {
        status: 200,
        headers: {
          "X-PAYMENT-RESPONSE": Buffer.from(
            JSON.stringify({ success: true, network: "base", txHash: "0xtx123", timestamp: Date.now() })
          ).toString("base64"),
        },
      })
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
      // Base64 encode the PAYMENT-REQUIRED header (V2 format)
      const paymentRequired = JSON.stringify({
              x402Version: 2,
              resource: "https://api.example.com/v2/resource",
              accepts: [{
                to: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
                amount: "1.0",
                network: "eip155:8453",
                asset: "eip155:8453/erc20:0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
                nonce: `${Date.now()}`,
                expiry: 1735718400,
              }]
            });
      const encoded = Buffer.from(paymentRequired).toString("base64");

      return Promise.resolve(
        new Response("Payment Required", {
          status: 402,
          headers: {
            "PAYMENT-REQUIRED": encoded,
          },
        })
      );
    }
    return Promise.resolve(
      new Response('{"result": "success"}', {
        status: 200,
        headers: {
          "PAYMENT-RESPONSE": JSON.stringify({
            status: "success",
            txHash: "0xabc456",
            timestamp: Date.now(),
          }),
        },
      })
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
    version: 1,
    defaultExpiry: 7200,
    nonceGenerator: () => customNonce,
  });

  const payment = await client.createPayment(
    "5.0",
    "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    8453,
    customExpiry
  );

  // x402 V1 format has nested structure, nonce is converted to hex
  expect(payment.payload.authorization.nonce).toBe("0x0000000000000000000000000000000000000000000000000000000999888777");
  expect(payment.payload.authorization.validBefore).toBe(customExpiry.toString());
});

// ========================================
// Error Handling for Failed Payments
// ========================================

test("throws SigningError when account lacks signTypedData", async () => {
  const incompleteAccount: Account = {
    address: "0x0000000000000000000000000000000000000001" as const,
    signMessage: async () => "0x" as const,
    signTransaction: async () => "0x" as const,
    // signTypedData is missing
  };

  const wallet: X402Wallet = { type: "account", account: incompleteAccount };
  const client = createX402Client({ wallet });

  await expect(
    client.createPayment(
      "1.0",
      "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      8453
    )
  ).rejects.toThrowError(SigningError);
});

test("throws PaymentError on failed settlement (v1)", async () => {
  const client = createX402Client({ wallet: mockWallet, version: 1 });

  let callCount = 0;
  global.fetch = mock(() => {
    callCount++;
    if (callCount === 1) {
      return Promise.resolve(
        new Response("Payment Required", {
          status: 402,
          headers: {
            "X-PAYMENT-REQUIRED": Buffer.from(
              JSON.stringify({
                amount: "1.0",
                network: "base",
                contractAddress: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
                payTo: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
                expiry: 1735718400,
              })
            ).toString("base64"),
          },
        })
      );
    }
    return Promise.resolve(
      new Response("Payment Failed", {
        status: 402,
        headers: {
          "X-PAYMENT-RESPONSE": Buffer.from(
            JSON.stringify({ success: false, error: "Insufficient funds" })
          ).toString("base64"),
        },
      })
    );
  });

  await expect(
    client.fetch("https://api.example.com/expensive")
  ).rejects.toThrowError(PaymentError);
});

test("throws PaymentError on failed settlement (v2)", async () => {
  const client = createX402Client({ wallet: mockWallet, version: 2 });

  let callCount = 0;
  global.fetch = mock(() => {
    callCount++;
    if (callCount === 1) {
      return Promise.resolve(
        new Response("Payment Required", {
          status: 402,
          headers: {
            "PAYMENT-REQUIRED": JSON.stringify({
              amount: "1.0",
              to: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
              chainId: "eip155:8453",
              assetId: "eip155:8453/erc20:0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
              nonce: `${Date.now()}`,
              expiry: 1735718400,
            }),
          },
        })
      );
    }
    return Promise.resolve(
      new Response("Payment Failed", {
        status: 402,
        headers: {
          "PAYMENT-RESPONSE": JSON.stringify({
            status: "failed",
            error: "Transaction reverted",
          }),
        },
      })
    );
  });

  await expect(
    client.fetch("https://api.example.com/v2/endpoint")
  ).rejects.toThrowError(PaymentError);
});

test("throws PaymentError on malformed v1 payment requirements", async () => {
  const client = createX402Client({ wallet: mockWallet, version: 1 });

  global.fetch = mock(() =>
    Promise.resolve(
      new Response("Payment Required", {
        status: 402,
        headers: {
          "X-PAYMENT-REQUIRED": "invalid-base64!!!",
        },
      })
    )
  );

  await expect(
    client.fetch("https://api.example.com/malformed")
  ).rejects.toThrowError(PaymentError);
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
      })
    )
  );

  await expect(
    client.fetch("https://api.example.com/bad-json")
  ).rejects.toThrowError(PaymentError);
});

test("handles network errors gracefully", async () => {
  const client = createX402Client({ wallet: mockWallet });

  global.fetch = mock(() =>
    Promise.reject(new Error("Network connection failed"))
  );

  await expect(
    client.fetch("https://api.example.com/network-error")
  ).rejects.toThrow("Network connection failed");
});

test("PaymentError includes error details", async () => {
  const client = createX402Client({ wallet: mockWallet, version: 1 });

  let callCount = 0;
  global.fetch = mock(() => {
    callCount++;
    if (callCount === 1) {
      return Promise.resolve(
        new Response("Payment Required", {
          status: 402,
          headers: {
            "X-PAYMENT-REQUIRED": Buffer.from(
              JSON.stringify({
                x402Version: 1,
                scheme: "exact",
                network: "base",
                accepts: [{
                  network: "base",
                  asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
                  payTo: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
                  maxAmountRequired: "1.0",
                  resource: "https://api.example.com/invalid-sig",
                  description: "Test resource",
                  maxTimeoutSeconds: 3600,
                }]
              })
            ).toString("base64"),
          },
        })
      );
    }
    return Promise.resolve(
      new Response("Payment Failed", {
        status: 402,
        headers: {
          "X-PAYMENT-RESPONSE": Buffer.from(
            JSON.stringify({ success: false, network: "base", errorReason: "Invalid signature" })
          ).toString("base64"),
        },
      })
    );
  });

  try {
    await client.fetch("https://api.example.com/invalid-sig");
    expect.unreachable();
  } catch (error) {
    expect(error).toBeInstanceOf(PaymentError);
    expect((error as PaymentError).message).toContain("Invalid signature");
  }
});
