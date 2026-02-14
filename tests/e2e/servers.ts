/**
 * E2E Test Server Factories
 */

import { serve } from "bun";
import { Hono } from "hono";
import express from "express";
import { Elysia } from "elysia";
import { acceptPaymentsViaArmory } from "../../packages/middleware-hono/src/index";
import { paymentMiddleware as expressPaymentMiddleware } from "../../packages/middleware-express/src/index";
import { paymentMiddleware as elysiaPaymentMiddleware } from "../../packages/middleware-elysia/src/index";
import { createBunMiddleware } from "../../packages/middleware-bun/src/index";

export interface TestServer {
  port: number;
  url: string;
  close: () => Promise<void>;
}

export interface ServerConfig {
  payTo: string;
  amount: string;
  network: string;
  defaultVersion?: 1 | 2;
}

const BASE_CONFIG = (config: ServerConfig) => ({
  payTo: config.payTo,
  amount: config.amount,
  network: config.network,
  defaultVersion: config.defaultVersion ?? 2,
  accept: {
    networks: [config.network],
    tokens: ["usdc"],
    facilitators: [{ url: process.env.FACILITATOR_URL || "https://facilitator.kobaru.network" }],
  },
});

let nextPort = 30000;

export const createHonoServer = async (config: ServerConfig): Promise<TestServer> => {
  let port = ++nextPort;
  const app = new Hono();
  app.use("/*", acceptPaymentsViaArmory(BASE_CONFIG(config)));

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
      server.stop(true);
      await new Promise((resolve) => setTimeout(resolve, 100));
    },
  };
};

export const createExpressServer = async (config: ServerConfig): Promise<TestServer> => {
  let port = ++nextPort;
  const app = express();

  app.use(expressPaymentMiddleware({
    requirements: {
      networks: [config.network],
      tokens: ["usdc"],
      facilitators: [{ url: process.env.FACILITATOR_URL || "https://facilitator.kobaru.network" }],
    },
    facilitatorUrl: process.env.FACILITATOR_URL || "https://facilitator.kobaru.network",
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

export const createElysiaServer = async (config: ServerConfig): Promise<TestServer> => {
  let port = ++nextPort;
  const app = new Elysia();

  const middlewarePlugin = elysiaPaymentMiddleware({
    requirements: {
      networks: [config.network],
      tokens: ["usdc"],
      facilitators: [{ url: process.env.FACILITATOR_URL || "https://facilitator.kobaru.network" }],
    },
    facilitatorUrl: process.env.FACILITATOR_URL || "https://facilitator.kobaru.network",
  });

  app.use(middlewarePlugin as any);

  app.get("/api/test", () => {
    const payment = app.store.payment;
    return Response.json({
      success: true,
      message: "Payment verified",
      middleware: "elysia",
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
      server = Bun.serve({
        fetch: app.fetch,
        port: port + i,
        hostname: "127.0.0.1",
      });
      port = port + i;
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
      server.stop(true);
      await new Promise((resolve) => setTimeout(resolve, 100));
    },
  };
};

export const createBunServer = async (config: ServerConfig): Promise<TestServer> => {
  let port = ++nextPort;
  const middleware = createBunMiddleware(BASE_CONFIG(config));

  // Retry with different ports if in use
  let server;
  for (let i = 0; i < 100; i++) {
    try {
      server = serve({
        port: port + i,
        hostname: "127.0.0.1",
        async fetch(req) {
          const url = new URL(req.url);
          if (url.pathname === "/api/test") {
            return middleware(req);
          }
          return new Response("Not found", { status: 404 });
        },
      });
      port = port + i;
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
      server.stop(true);
      await new Promise((resolve) => setTimeout(resolve, 100));
    },
  };
};
