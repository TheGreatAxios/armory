/**
 * X-402 Merchant Server - ElysiaJS
 *
 * Example merchant server using ElysiaJS with X-402 payment middleware.
 * Demonstrates protected routes that require payment for access.
 */

import { Elysia, t } from "elysia";
import { cors } from "@elysiajs/cors";
import type { Address } from "viem";
import { elysiaPaymentMiddleware, type PaymentInfo } from "@armory/middleware";
import type { PaymentRequirementsV2 } from "@armory/base";
import { USDC_BASE } from "@armory/tokens";

// ============================================================================
// Configuration
// ============================================================================

const PORT = Number.parseInt(process.env.PORT ?? "3004", 10);
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

// Facilitator URL (optional)
const FACILITATOR_URL = process.env.FACILITATOR_URL;

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

const paymentRequirements = createPaymentRequirements();

// ============================================================================
// Setup Elysia App
// ============================================================================

const app = new Elysia()
  .use(cors())
  // ============================================================================
  // Public Routes
  // ============================================================================

  /**
   * GET /
   * Public welcome endpoint
   */
  .get("/", () => ({
    name: "X-402 Merchant Server (ElysiaJS)",
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
  }))

  /**
   * GET /health
   * Health check endpoint
   */
  .get("/health", () => ({
    status: "ok",
    timestamp: Date.now(),
    server: "elysia",
  }))

  /**
   * GET /products
   * Public product listing
   */
  .get("/products", () => ({
    products: [
      { id: 1, name: "Basic Plan", price: "0", description: "Free tier" },
      { id: 2, name: "Premium Plan", price: "1000000", description: "1 USDC - Premium features" },
      { id: 3, name: "Enterprise Plan", price: "10000000", description: "10 USDC - Full access" },
    ],
  }))

  // ============================================================================
  // Protected Routes (Require Payment)
  // ============================================================================

  /**
   * GET /api/premium
   * Protected endpoint requiring payment
   */
  .use(
    new Elysia({ name: "premium-middleware" })
      .use(
        elysiaPaymentMiddleware({
          requirements: paymentRequirements,
          facilitatorUrl: FACILITATOR_URL,
        })
      )
      .get("/api/premium", ({ store }) => {
        // Payment info is attached to store
        const payment = store.payment as PaymentInfo;

        return {
          message: "Welcome to the premium content!",
          payer: payment.payerAddress,
          verified: payment.verified,
          content: {
            title: "Premium Article",
            body: "This is premium content that requires payment to access.",
            features: ["Ad-free experience", "Exclusive content", "Early access"],
          },
        };
      })
  )

  /**
   * POST /api/purchase
   * Purchase endpoint with custom amount
   */
  .use(
    new Elysia({ name: "purchase-middleware" })
      .use(
        elysiaPaymentMiddleware({
          requirements: paymentRequirements,
          facilitatorUrl: FACILITATOR_URL,
        })
      )
      .post(
        "/api/purchase",
        async ({ store, body }) => {
          const payment = store.payment as PaymentInfo;
          const { itemId } = body as { itemId?: string };

          return {
            message: "Purchase successful!",
            orderId: `order_${Date.now()}`,
            payer: payment.payerAddress,
            item: itemId ?? "premium_access",
            timestamp: new Date().toISOString(),
          };
        },
        {
          body: t.Object({
            itemId: t.Optional(t.String()),
          }),
        }
      )
  )

  /**
   * GET /api/user/profile
   * User profile endpoint
   */
  .use(
    new Elysia({ name: "profile-middleware" })
      .use(
        elysiaPaymentMiddleware({
          requirements: paymentRequirements,
          facilitatorUrl: FACILITATOR_URL,
        })
      )
      .get("/api/user/profile", ({ store }) => {
        const payment = store.payment as PaymentInfo;

        return {
          profile: {
            walletAddress: payment.payerAddress,
            tier: "premium",
            memberSince: new Date().toISOString(),
            features: ["api_access", "premium_content", "priority_support"],
          },
        };
      })
  )

  // ============================================================================
  // Error Handling
  // ============================================================================

  /**
   * 404 handler
   */
  .onError(({ code, error, set }) => {
    if (code === "NOT_FOUND") {
      set.status = 404;
      return {
        error: "Not found",
      };
    }

    // Payment errors
    if (error instanceof Response) {
      return error;
    }

    // Generic error
    console.error("Error:", error);
    set.status = 500;
    return {
      error: "Internal server error",
      message: error.message,
    };
  });

// ============================================================================
// Start Server
// ============================================================================

app.listen(PORT, HOST as string);

console.log(`
╔════════════════════════════════════════════════════════════╗
║           X-402 Merchant Server (ElysiaJS)                 ║
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

// ============================================================================
// Graceful Shutdown
// ============================================================================

const shutdown = (signal: string) => {
  console.log(`\nReceived ${signal}, shutting down gracefully...`);
  process.exit(0);
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
