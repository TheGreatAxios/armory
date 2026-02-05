/**
 * X-402 Merchant Server - Express.js
 *
 * Example merchant server using Express.js with X-402 payment middleware.
 * Demonstrates protected routes that require payment for access.
 */

import express from "express";
import type { Address } from "viem";
import { paymentMiddleware } from "@armory/middleware";
import type { PaymentRequirementsV2 } from "@armory/base";
import { USDC_BASE } from "@armory/tokens";

// ============================================================================
// Configuration
// ============================================================================

const PORT = Number.parseInt(process.env.PORT ?? "3001", 10);
const HOST = process.env.HOST ?? "0.0.0.0";

// Payment configuration
const PAYMENT_TO: Address = (process.env.PAYMENT_TO_ADDRESS ?? "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb") as Address;
const PAYMENT_AMOUNT = process.env.PAYMENT_AMOUNT ?? "1000000"; // 1 USDC
const PAYMENT_NETWORK = process.env.PAYMENT_NETWORK ?? "base";
const PAYMENT_EXPIRY = Number.parseInt(process.env.PAYMENT_EXPIRY ?? "3600", 10);

// ============================================================================
// Token Configuration (Recommended Approach)
// ============================================================================

// Using pre-configured token from @armory/tokens
const PAYMENT_TOKEN = USDC_BASE;

// USDC Contract addresses (for reference - not used in this example)
// const USDC_ADDRESSES: Record<string, Address> = {
//   ethereum: (process.env.USDC_ETHEREUM ?? "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48") as Address,
//   base: (process.env.USDC_BASE ?? "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913") as Address,
//   optimism: (process.env.USDC_OPTIMISM ?? "0x7F5c764cBc14f9669B88837ca1490cCa17c31607") as Address,
//   arbitrum: (process.env.USDC_ARBITRUM ?? "0xaf88d065e77c8cC2239327C5EDb3A432268e5831") as Address,
//   polygon: (process.env.USDC_POLYGON ?? "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359") as Address,
// };

// ============================================================================
// Setup Express App
// ============================================================================

const app = express();

// Parse JSON bodies
app.use(express.json());

// ============================================================================
// Public Routes
// ============================================================================

/**
 * GET /
 * Public welcome endpoint
 */
app.get("/", (_req, res) => {
  res.json({
    name: "X-402 Merchant Server (Express)",
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
    },
  });
});

/**
 * GET /health
 * Health check endpoint
 */
app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    timestamp: Date.now(),
    server: "express",
  });
});

/**
 * GET /products
 * Public product listing
 */
app.get("/products", (_req, res) => {
  res.json({
    products: [
      { id: 1, name: "Basic Plan", price: "0", description: "Free tier" },
      { id: 2, name: "Premium Plan", price: "1000000", description: "1 USDC - Premium features" },
      { id: 3, name: "Enterprise Plan", price: "10000000", description: "10 USDC - Full access" },
    ],
  });
});

// ============================================================================
// Protected Routes (Require Payment)
// ============================================================================

/**
 * Create payment requirements for the configured network
 *
 * New approach (recommended): Use token object
 */
function createPaymentRequirements(customAmount?: string): PaymentRequirementsV2 {
  return {
    to: PAYMENT_TO,
    amount: customAmount ?? PAYMENT_AMOUNT,
    expiry: Math.floor(Date.now() / 1000) + PAYMENT_EXPIRY,
    token: PAYMENT_TOKEN, // Use pre-configured token object
  };
}

// Legacy approach (manual configuration):
// function createPaymentRequirements(customAmount?: string): PaymentRequirementsV2 {
//   const chainId = CHAIN_IDS[PAYMENT_NETWORK] ?? 8453;
//   const usdcAddress = USDC_ADDRESSES[PAYMENT_NETWORK] ?? USDC_ADDRESSES.base;
//
//   return {
//     to: PAYMENT_TO,
//     amount: customAmount ?? PAYMENT_AMOUNT,
//     expiry: Math.floor(Date.now() / 1000) + PAYMENT_EXPIRY,
//     chainId: `eip155:${chainId}`,
//     assetId: `eip155:${chainId}/erc20:${usdcAddress}`,
//   };
// }

/**
 * GET /api/premium
 * Protected endpoint requiring payment
 */
app.get(
  "/api/premium",
  paymentMiddleware({
    requirements: createPaymentRequirements(),
    facilitatorUrl: FACILITATOR_URL,
  }),
  (req, res) => {
    // Payment info is attached to req.payment by middleware
    const payment = (req as unknown as { payment?: { payerAddress: string; verified: boolean } }).payment;

    res.json({
      message: "Welcome to the premium content!",
      payer: payment?.payerAddress,
      verified: payment?.verified,
      content: {
        title: "Premium Article",
        body: "This is premium content that requires payment to access.",
        features: ["Ad-free experience", "Exclusive content", "Early access"],
      },
    });
  }
);

/**
 * POST /api/purchase
 * Purchase endpoint with custom amount
 */
app.post(
  "/api/purchase",
  paymentMiddleware({
    requirements: createPaymentRequirements(),
    facilitatorUrl: FACILITATOR_URL,
  }),
  (req, res) => {
    const payment = (req as unknown as { payment?: { payerAddress: string } }).payment;
    const { itemId } = req.body;

    res.json({
      message: "Purchase successful!",
      orderId: `order_${Date.now()}`,
      payer: payment?.payerAddress,
      item: itemId ?? "premium_access",
      timestamp: new Date().toISOString(),
    });
  }
);

/**
 * GET /api/user/profile
 * User profile endpoint
 */
app.get(
  "/api/user/profile",
  paymentMiddleware({
    requirements: createPaymentRequirements(),
    facilitatorUrl: FACILITATOR_URL,
  }),
  (req, res) => {
    const payment = (req as unknown as { payment?: { payerAddress: string } }).payment;

    res.json({
      profile: {
        walletAddress: payment?.payerAddress,
        tier: "premium",
        memberSince: new Date().toISOString(),
        features: ["api_access", "premium_content", "priority_support"],
      },
    });
  }
);

// ============================================================================
// Error Handling
// ============================================================================

/**
 * 404 handler
 */
app.use((req, res) => {
  res.status(404).json({
    error: "Not found",
    path: req.path,
  });
});

/**
 * Global error handler
 */
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("Error:", err);
  res.status(500).json({
    error: "Internal server error",
    message: err.message,
  });
});

// ============================================================================
// Start Server
// ============================================================================

app.listen(PORT, HOST as string, () => {
  console.log(`
╔════════════════════════════════════════════════════════════╗
║           X-402 Merchant Server (Express)                  ║
╠════════════════════════════════════════════════════════════╣
║  URL:         http://${HOST}:${String(PORT).padEnd(44)}║
║  Network:     ${PAYMENT_NETWORK.padEnd(47)}║
║  Amount:      ${PAYMENT_AMOUNT} USDC (${(Number.parseInt(PAYMENT_AMOUNT) / 1_000_000).toFixed(2)} USDC)${String("").padEnd(15)}║
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
});

// ============================================================================
// Graceful Shutdown
// ============================================================================

const shutdown = (signal: string) => {
  console.log(`\nReceived ${signal}, shutting down gracefully...`);
  process.exit(0);
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
