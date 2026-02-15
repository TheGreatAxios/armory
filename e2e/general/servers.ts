/**
 * E2E Test Server Factories
 */

import { serve } from "bun";
import { Hono } from "hono";
import express from "express";
import { paymentMiddleware as honoPaymentMiddleware } from "@armory-sh/middleware-hono";
import { paymentMiddleware as expressPaymentMiddleware } from "@armory-sh/middleware-express";
import {
  getNetworkConfig,
  normalizeNetworkName,
} from "@armory-sh/base";
import type { X402PaymentRequirements } from "@armory-sh/base";

export interface TestServer {
  port: number;
  url: string;
  close: () => Promise<void>;
}

export interface ServerConfig {
  payTo: string;
  amount: string;
  network: string;
}

/**
 * Get a random available port for testing
 * Using high port range to avoid conflicts
 */
const getRandomPort = (): number => 30000 + Math.floor(Math.random() * 10000);

/**
 * Convert decimal amount to atomic units (6 decimals for USDC)
 */
const toAtomicUnits = (amount: string): string => {
  if (amount.includes(".")) {
    const [whole, fractional = ""] = amount.split(".");
    const paddedFractional = fractional.padEnd(6, "0").slice(0, 6);
    return `${whole}${paddedFractional}`.replace(/^0+/, "") || "0";
  }
  return `${amount}000000`;
};

/**
 * Create x402 PaymentRequirements from simple config
 */
const createRequirements = (config: ServerConfig) => {
  const networkName = normalizeNetworkName(config.network);
  const network = getNetworkConfig(networkName);
  if (!network) {
    throw new Error(`Unsupported network: ${networkName}`);
  }

  const atomicAmount = toAtomicUnits(config.amount);

  return {
    scheme: "exact",
    network: network.caip2Id,
    amount: atomicAmount,
    payTo: config.payTo as `0x${string}`,
    maxTimeoutSeconds: 300,
    asset: network.usdcAddress as `0x${string}`,
    extra: {
      name: "USD Coin",
      version: "2",
    },
  };
};

export const createHonoServer = async (config: ServerConfig): Promise<TestServer> => {
  const app = new Hono();

  const requirements = createRequirements(config);
  app.use("/*", honoPaymentMiddleware({ requirements }));

  app.get("/api/test", (c) => {
    const payment = c.get("payment");
    return c.json({
      success: true,
      message: "Payment verified",
      middleware: "hono",
      payment: payment ? {
        payerAddress: payment.payerAddress,
        version: payment.payload.x402Version,
      } : null,
    });
  });

  const server = serve({
    fetch: app.fetch,
    port: 0,
    hostname: "localhost",
  });

  await new Promise((resolve) => setTimeout(resolve, 50));

  const port = server.port;
  const url = `http://localhost:${port}`;

  return {
    port,
    url,
    close: async () => {
      server.stop(true);
      await new Promise((resolve) => setTimeout(resolve, 100));
    },
  };
};

export const createExpressServer = async (config: ServerConfig): Promise<TestServer> => {
  const app = express();

  const requirements = createRequirements(config);
  app.use(expressPaymentMiddleware({ requirements }));

  app.get("/api/test", (req: any, res: any) => {
    const payment = (req as any).payment;
    res.json({
      success: true,
      message: "Payment verified",
      middleware: "express",
      payment: payment ? {
        payerAddress: payment.payerAddress,
        version: payment.payload.x402Version,
      } : null,
    });
  });

  const srv = app.listen(0, "localhost");

  await new Promise((resolve) => setTimeout(resolve, 50));

  const address = srv.address() as { port: number };
  const port = address.port;
  const url = `http://localhost:${port}`;

  return {
    port,
    url,
    close: async () => {
      srv.close();
      await new Promise((resolve) => setTimeout(resolve, 100));
    },
  };
};
