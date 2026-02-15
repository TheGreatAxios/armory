/**
 * E2E Test Server Factories
 */

import { serve } from "bun";
import { Hono } from "hono";
import express from "express";
import { acceptPaymentsViaArmory } from "../../packages/middleware-hono/src/index";
import { paymentMiddleware as expressPaymentMiddleware } from "../../packages/middleware-express/src/index";

export interface TestServer {
  port: number;
  url: string;
  close: () => Promise<void>;
}

export interface ServerConfig {
  payTo: string;
  amount: string;
  network: string;
  version?: 1 | 2;
}

const BASE_CONFIG = (config: ServerConfig) => ({
  payTo: config.payTo,
  amount: config.amount,
  network: config.network,
  defaultVersion: config.version ?? 2,
  accept: {
    networks: [config.network],
    tokens: ["usdc"],
    facilitators: [{ url: process.env.FACILITATOR_URL || "https://facilitator.payai.network" }],
  },
});

let nextPort = 30000;

function getNextPort(): number {
  return ++nextPort;
}

async function cleanupPorts(startPort: number = 30000, endPort: number = 30200): Promise<void> {
  // Try to clean up any lingering servers on test ports
  const { kill } = await import("node:child_process");
  try {
    // Kill any processes on test ports (macOS/BSD)
    kill("lsof", ["-ti", `${startPort}-${endPort}`].join(" "), { stdio: "pipe" });
  } catch {
    // Ignore cleanup errors
  }
}

function markPortUsed(port: number): void {
  nextPort = Math.max(nextPort, port);
}

export const createHonoServer = async (config: ServerConfig): Promise<TestServer> => {
  let port = getNextPort();
  const app = new Hono();

  try {
    // Use provided version or default to 2
    const serverConfig = config.version ? { ...config, defaultVersion: config.version } : config;
    app.use("/*", acceptPaymentsViaArmory(BASE_CONFIG(serverConfig)));

    app.get("/api/test", (c) => {
      const payment = c.get("payment");
      return c.json({
        success: true,
        message: "Payment verified",
        middleware: "hono",
        payment: payment ? {
          payerAddress: payment.payerAddress,
          version: payment.version,
        } : null,
      });
    });

    // Retry with different ports if in use
    let server;
    for (let i = 0; i < 100; i++) {
      try {
        server = serve({
          fetch: app.fetch,
          port: port + i,
          hostname: "127.0.0.1",
        });
        port = port + i;
        markPortUsed(port);
        break;
      } catch (e) {
        // Log error for debugging
        const errorMsg = e instanceof Error ? e.message : String(e);
        if (i === 99) throw new Error(`No available ports (last error: ${errorMsg})`);
      }
    }

    await new Promise((resolve) => setTimeout(resolve, 50));

    return {
      port,
      url: `http://127.0.0.1:${port}`,
      close: async () => {
        server.stop(true);
        await new Promise((resolve) => setTimeout(resolve, 100));
      },
    };
  } catch (error) {
    // Ensure cleanup if server creation fails
    throw new Error(`Hono server creation failed: ${error instanceof Error ? error.message : String(error)}`);
  }
};

export const createExpressServer = async (config: ServerConfig): Promise<TestServer> => {
  let port = getNextPort();
  const app = express();

  app.use(expressPaymentMiddleware({
    requirements: {
      networks: [config.network],
      tokens: ["usdc"],
      facilitators: [{ url: process.env.FACILITATOR_URL || "https://facilitator.payai.network" }],
    },
    facilitatorUrl: process.env.FACILITATOR_URL || "https://facilitator.payai.network",
  }));

  app.get("/api/test", (req: any, res: any) => {
    const payment = (req as any).payment;
    res.json({
      success: true,
      message: "Payment verified",
      middleware: "express",
      payment: payment ? {
        payerAddress: payment.payerAddress,
        version: payment.version,
      } : null,
    });
  });

  // Retry with different ports if in use
  let srv;
  for (let i = 0; i < 100; i++) {
    try {
      srv = app.listen(port + i, "127.0.0.1");
      port = port + i;
      markPortUsed(port);
      break;
    } catch {
      if (i === 99) throw new Error("No available ports");
    }
  }

  await new Promise((resolve) => setTimeout(resolve, 50));

  return {
    port,
    url: `http://127.0.0.1:${port}`,
    close: async () => {
      srv.close();
      await new Promise((resolve) => setTimeout(resolve, 100));
    },
  };
};
