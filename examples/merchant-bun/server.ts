/**
 * X-402 Merchant Server - Native Bun
 *
 * Example merchant server using native Bun.serve with X-402 payment middleware.
 * Demonstrates protected routes that require payment for access.
 */

import type { Address } from "viem";
import { createBunMiddleware, type BunMiddlewareConfig } from "@armory/middleware";
import { createPaymentRequirements } from "@armory/middleware/core";
import { USDC_BASE } from "@armory/tokens";

// ============================================================================
// Configuration
// ============================================================================

const PORT = Number.parseInt(process.env.PORT ?? "3003", 10);
const HOST = process.env.HOST ?? "0.0.0.0";

// Payment configuration
const PAYMENT_TO: Address = (process.env.PAYMENT_TO_ADDRESS ?? "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb") as Address;
const PAYMENT_AMOUNT = process.env.PAYMENT_AMOUNT ?? "1000000"; // 1 USDC
const PAYMENT_NETWORK = process.env.PAYMENT_NETWORK ?? "base";
const PAYMENT_EXPIRY = Number.parseInt(process.env.PAYMENT_EXPIRY ?? "3600", 10);
const SETTLEMENT_MODE = process.env.SETTLEMENT_MODE ?? "verify";

// Facilitator URL
const FACILITATOR_URL = process.env.FACILITATOR_URL ?? "http://localhost:3000";

// ============================================================================
// Token Configuration (Recommended Approach)
// ============================================================================

// Using pre-configured token from @armory/tokens
// This provides all token metadata including contract address, chainId, decimals, etc.
const PAYMENT_TOKEN = USDC_BASE;

// Alternatively, you can register a custom token:
// import { registerToken } from "@armory/core";
// const PAYMENT_TOKEN = registerToken({
//   symbol: "USDC",
//   name: "USD Coin",
//   version: "2",
//   contractAddress: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
//   chainId: 8453,
//   decimals: 6,
// });

// ============================================================================
// Payment Middleware Configuration
// ============================================================================

// Create payment requirements using the token object (recommended approach)
const paymentRequirements = createPaymentRequirements({
  to: PAYMENT_TO,
  amount: PAYMENT_AMOUNT,
  expiry: Math.floor(Date.now() / 1000) + PAYMENT_EXPIRY,
  token: PAYMENT_TOKEN, // Use pre-configured token object
});

const middlewareConfig: BunMiddlewareConfig = {
  requirements: paymentRequirements,
  settlementMode: SETTLEMENT_MODE === "settle" ? "settle" : "verify",
  facilitator: {
    url: FACILITATOR_URL,
  },
  defaultVersion: 2,
  waitForSettlement: false,
};

// Alternatively, you can use individual fields (legacy approach):
// const middlewareConfig: BunMiddlewareConfig = {
//   payTo: PAYMENT_TO,
//   network: PAYMENT_NETWORK,
//   amount: PAYMENT_AMOUNT,
//   settlementMode: SETTLEMENT_MODE === "settle" ? "settle" : "verify",
//   facilitator: {
//     url: FACILITATOR_URL,
//   },
//   defaultVersion: 2,
//   waitForSettlement: false,
// };

// Create the payment middleware
const paymentMiddleware = createBunMiddleware(middlewareConfig);

// ============================================================================
// Response Helpers
// ============================================================================

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
    },
  });
}

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
    },
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

  // GET / - Welcome and info
  if (path === "/" && method === "GET") {
    return jsonResponse({
      name: "X-402 Merchant Server (Bun)",
      version: "1.0.0",
      endpoints: {
        public: {
          "GET /": "Welcome message",
          "GET /health": "Health check",
          "GET /products": "List products (public)",
        },
        protected: {
          "GET /api/premium": "Premium content (requires payment)",
          "POST /api/purchase": "Purchase endpoint (requires payment)",
          "GET /api/user/profile": "User profile (requires payment)",
        },
      },
      payment: {
        network: PAYMENT_NETWORK,
        amount: PAYMENT_AMOUNT,
        currency: "USDC",
        settlementMode: SETTLEMENT_MODE,
      },
    });
  }

  // GET /health - Health check
  if (path === "/health" && method === "GET") {
    return jsonResponse({
      status: "ok",
      timestamp: Date.now(),
      server: "bun",
    });
  }

  // GET /products - Public product listing
  if (path === "/products" && method === "GET") {
    return jsonResponse({
      products: [
        { id: 1, name: "Basic Plan", price: "0", description: "Free tier" },
        { id: 2, name: "Premium Plan", price: "1000000", description: "1 USDC - Premium features" },
        { id: 3, name: "Enterprise Plan", price: "10000000", description: "10 USDC - Full access" },
      ],
    });
  }

  // ============================================================================
  // Protected Routes (Require Payment)
  // ============================================================================

  // All /api routes require payment
  if (path.startsWith("/api/")) {
    // Apply payment middleware
    const paymentResult = await paymentMiddleware(request);

    // If middleware returned a response with 402, payment was not provided/valid
    if (paymentResult.status === 402) {
      return paymentResult;
    }

    // Parse the payment result
    const paymentData = await paymentResult.json() as {
      verified: boolean;
      payerAddress: string;
      version: number;
      settlement?: {
        success: boolean;
        txHash?: string;
      };
    };

    // GET /api/premium - Premium content
    if (path === "/api/premium" && method === "GET") {
      return jsonResponse({
        message: "Welcome to the premium content!",
        payer: paymentData.payerAddress,
        verified: paymentData.verified,
        content: {
          title: "Premium Article",
          body: "This is premium content that requires payment to access.",
          features: ["Ad-free experience", "Exclusive content", "Early access"],
        },
        settlement: paymentData.settlement,
      });
    }

    // POST /api/purchase - Purchase endpoint
    if (path === "/api/purchase" && method === "POST") {
      try {
        const body = await request.json() as { itemId?: string };
        return jsonResponse({
          message: "Purchase successful!",
          orderId: `order_${Date.now()}`,
          payer: paymentData.payerAddress,
          item: body.itemId ?? "premium_access",
          timestamp: new Date().toISOString(),
          settlement: paymentData.settlement,
        });
      } catch {
        return jsonResponse({ error: "Invalid JSON" }, 400);
      }
    }

    // GET /api/user/profile - User profile
    if (path === "/api/user/profile" && method === "GET") {
      return jsonResponse({
        profile: {
          walletAddress: paymentData.payerAddress,
          tier: "premium",
          memberSince: new Date().toISOString(),
          features: ["api_access", "premium_content", "priority_support"],
        },
        settlement: paymentData.settlement,
      });
    }
  }

  // ============================================================================
  // 404 Handler
  // ============================================================================

  return jsonResponse(
    {
      error: "Not found",
      path,
      method,
    },
    404
  );
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
║           X-402 Merchant Server (Bun)                      ║
╠════════════════════════════════════════════════════════════╣
║  URL:           ${server.url.origin.padEnd(43)}║
║  Port:          ${String(server.port).padEnd(47)}║
║  Network:       ${PAYMENT_NETWORK.padEnd(47)}║
║  Amount:        ${PAYMENT_AMOUNT} USDC (${(Number.parseInt(PAYMENT_AMOUNT) / 1_000_000).toFixed(2)} USDC)${String("").padEnd(12)}║
║  Settlement:    ${SETTLEMENT_MODE.padEnd(47)}║
╠════════════════════════════════════════════════════════════╣
║  Public Routes:                                           ║
║    GET  /               - Welcome & info                  ║
║    GET  /health         - Health check                    ║
║    GET  /products       - Product listing                 ║
╠════════════════════════════════════════════════════════════╣
║  Protected Routes (Require Payment):                      ║
║    GET  /api/premium     - Premium content                ║
║    POST /api/purchase    - Purchase endpoint              ║
║    GET  /api/user/profile - User profile                  ║
╚════════════════════════════════════════════════════════════╝
`);

// ============================================================================
// Graceful Shutdown
// ============================================================================

const shutdown = (signal: string) => {
  console.log(`\nReceived ${signal}, shutting down gracefully...`);
  server.stop();
  process.exit(0);
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
