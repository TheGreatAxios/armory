/**
 * Simple One-Line API Example - Bun Server
 *
 * This demonstrates the NEW simplified Armory API with:
 * - 1-line middleware setup
 * - Network/token resolution by name
 * - Multi-network/token/facilitator support
 */

import { acceptPaymentsViaArmory } from "@armory/middleware";

// ============================================================================
// Configuration
// ============================================================================

const PORT = Number.parseInt(process.env.PORT ?? "3003", 10);
const HOST = process.env.HOST ?? "0.0.0.0";

const PAYMENT_TO =
  process.env.PAYMENT_TO_ADDRESS ?? "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb";
const FACILITATOR_URL = process.env.FACILITATOR_URL ?? "http://localhost:3000";

// ============================================================================
// Simple One-Line Middleware Setup
// ============================================================================

// Option 1: Simple - single network, default USDC
const simpleMiddleware = acceptPaymentsViaArmory({
  payTo: PAYMENT_TO,
  amount: "1.0",
  facilitatorUrl: FACILITATOR_URL,
});

// Option 2: Advanced - multi-network, multi-token, multi-facilitator
const advancedMiddleware = acceptPaymentsViaArmory({
  payTo: PAYMENT_TO,
  amount: "1.0",
  accept: {
    networks: ["base", "ethereum", "skale-base"],
    tokens: ["usdc", "eurc"],
    facilitators: [
      { url: FACILITATOR_URL },
      // Add backup facilitators here
    ],
  },
});

// Use whichever middleware you prefer
const paymentMiddleware = simpleMiddleware;

// ============================================================================
// Response Helpers
// ============================================================================

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// ============================================================================
// Request Router
// ============================================================================

async function handleRequest(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;

  // ============================================================================
  // Public Routes
  // ============================================================================

  if (path === "/" && method === "GET") {
    return jsonResponse({
      name: "Armory Simple API Example",
      version: "2.0.0",
      description: "Demonstrates the new one-line Armory API",
      quickstart: {
        install: "bun add @armory/middleware",
        client: "import { armoryPay } from '@armory/client-viem'",
        merchant:
          "import { acceptPaymentsViaArmory } from '@armory/middleware'",
      },
      endpoints: {
        public: {
          "GET /": "This message",
          "GET /health": "Health check",
        },
        protected: {
          "GET /api/data": "Protected data (requires payment)",
        },
      },
    });
  }

  if (path === "/health" && method === "GET") {
    return jsonResponse({ status: "ok", timestamp: Date.now() });
  }

  // ============================================================================
  // Protected Routes (Require Payment)
  // ============================================================================

  if (path.startsWith("/api/")) {
    // Apply payment middleware - ONE LINE!
    const paymentResult = await paymentMiddleware(request);

    // If 402, payment was required but not provided
    if (paymentResult.status === 402) {
      return paymentResult;
    }

    // Payment verified - parse result
    const paymentData = (await paymentResult.json()) as {
      verified: boolean;
      payerAddress: string;
      version: number;
      settlement?: { success: boolean; txHash?: string };
    };

    // Return protected data
    return jsonResponse({
      message: "Payment successful! Here's your protected data.",
      payer: paymentData.payerAddress,
      data: {
        secret: "The answer to life, the universe, and everything is 42",
        timestamp: new Date().toISOString(),
      },
      settlement: paymentData.settlement,
    });
  }

  return jsonResponse({ error: "Not found" }, 404);
}

// ============================================================================
// Start Server
// ============================================================================

const server = Bun.serve({
  port: PORT,
  hostname: HOST,
  fetch: handleRequest,
});

console.log(`
╔════════════════════════════════════════════════════════════╗
║     Armory Simple API Example - Bun Server                 ║
╠════════════════════════════════════════════════════════════╣
║  URL:           ${server.url.origin.padEnd(43)}║
║  Port:          ${String(server.port).padEnd(47)}║
╠════════════════════════════════════════════════════════════╣
║  This example shows the NEW simplified Armory API:         ║
║                                                           ║
║  Merchant (1 line):                                        ║
║    app.use(acceptPaymentsViaArmory({                      ║
║      payTo: '0x...',                                       ║
║      amount: '1.0'                                         ║
║    }));                                                    ║
║                                                           ║
║  Client (1 line):                                          ║
║    await armoryPay(wallet, url, 'base', 'usdc');          ║
╠════════════════════════════════════════════════════════════╣
║  Routes:                                                  ║
║    GET  /           - API info                            ║
║    GET  /health      - Health check                        ║
║    GET  /api/data    - Protected data (requires payment)   ║
╚════════════════════════════════════════════════════════════╝
`);

// ============================================================================
// Graceful Shutdown
// ============================================================================

const shutdown = (signal: string) => {
  console.log(`\nReceived ${signal}, shutting down...`);
  server.stop();
  process.exit(0);
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
