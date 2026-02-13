/**
 * E2E Test Setup
 * 
 * This file provides a test server that uses the middleware
 * to test against real SDKs (Faremeter, Coinbase x402)
 */

import { Hono } from "hono";
import { acceptPaymentsViaArmory } from "@armory-sh/middleware-hono";
import { privateKeyToAccount } from "viem/accounts";
import { http, createPublicClient } from "viem";
import { baseSepolia } from "viem/chains";

const TEST_PRIVATE_KEY = process.env.TEST_PRIVATE_KEY || "0x0000000000000000000000000000000000000000000000000000000000000001";
const PAYMENT_ADDRESS = process.env.PAYMENT_ADDRESS || "0x1234567890123456789012345678901234567890";
const USDC_CONTRACT = "0x036CbD53842c5426634e7929541eC2318f3dCF7e"; // Base Sepolia USDC

export function createTestServer() {
  const app = new Hono();

  // Apply payment middleware
  app.use(
    "/api/*",
    acceptPaymentsViaArmory({
      payToAddress: PAYMENT_ADDRESS,
      token: {
        symbol: "USDC",
        name: "USD Coin",
        version: "2",
        contractAddress: USDC_CONTRACT,
        chainId: 84532,
        decimals: 6,
      },
      amount: "1000000", // 1 USDC
      network: "base-sepolia",
    })
  );

  // Test endpoint
  app.get("/api/test", (c) => {
    const payment = c.get("payment");
    return c.json({
      success: true,
      message: "Payment verified!",
      payment: payment ? {
        payerAddress: payment.payerAddress,
        version: payment.version,
      } : null,
    });
  });

  // Protected endpoint
  app.get("/api/premium", (c) => {
    return c.json({
      data: "This is premium content",
    });
  });

  return app;
}

export function getTestAccount() {
  return privateKeyToAccount(TEST_PRIVATE_KEY as `0x${string}`);
}

export function getTestPublicClient() {
  return createPublicClient({
    chain: baseSepolia,
    transport: http(),
  });
}

export const TEST_CONFIG = {
  privateKey: TEST_PRIVATE_KEY,
  paymentAddress: PAYMENT_ADDRESS,
  usdcContract: USDC_CONTRACT,
  chainId: 84532, // Base Sepolia
  network: "base-sepolia" as const,
};
