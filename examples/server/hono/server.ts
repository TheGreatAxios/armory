/**
 * Hono Server with X-402 Payment Middleware
 *
 * This example demonstrates how to use @armory/middleware with Hono v4
 * to protect API routes with X-402 payment requirements.
 *
 * Features:
 * - Public route (no payment required)
 * - Protected route (requires valid payment)
 * - Integration with payment facilitator
 * - V2 protocol (PAYMENT-SIGNATURE header)
 */

import type { PaymentRequirementsV2 } from "@armory/base";
import {
  createFacilitatorServer,
  createMemoryNonceTracker,
  createMemoryQueue,
} from "@armory/facilitator";
import { honoPaymentMiddleware, type PaymentInfo } from "@armory/middleware";
import { Hono } from "hono";
import { hc } from "hono/client";

// ============================================================================
// Configuration
// ============================================================================

const PORT = parseInt(process.env.PORT ?? "3001", 10);
const FACILITATOR_PORT = parseInt(process.env.FACILITATOR_PORT ?? "3000", 10);

// Your receiving wallet address
const PAY_TO_ADDRESS = "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb" as const;

// Payment requirements for the protected route
const PAYMENT_REQUIREMENTS: PaymentRequirementsV2 = {
  // Amount in smallest unit (USDC uses 6 decimals)
  // 1000000 = 1 USDC
  amount: "1000000",

  // Recipient address
  to: PAY_TO_ADDRESS,

  // Payment expiry timestamp (1 hour from now)
  expiry: Math.floor(Date.now() / 1000) + 3600,

  // Chain ID in CAIP-2 format
  chainId: "eip155:8453", // Base

  // Asset ID in CAIP-19 format (USDC on Base)
  assetId: "eip155:8453/erc20:0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
};

// ============================================================================
// Types
// ============================================================================

// Extend Hono context with payment info
type Env = {
  Variables: {
    payment: PaymentInfo;
  };
};

// ============================================================================
// Facilitator Setup (Optional)
// ============================================================================

// Start facilitator server if enabled
const facilitatorEnabled = process.env.ENABLE_FACILITATOR === "true";

if (facilitatorEnabled) {
  const nonceTracker = createMemoryNonceTracker();
  const paymentQueue = createMemoryQueue();

  const facilitator = createFacilitatorServer({
    port: FACILITATOR_PORT,
    nonceTracker,
    paymentQueue,
    rpcUrls: {
      8453: process.env.BASE_RPC_URL ?? "https://mainnet.base.org",
      1: process.env.ETH_RPC_URL ?? "https://eth.llamarpc.com",
    },
    privateKey: process.env.PRIVATE_KEY as `0x${string}`,
  });

  console.log(`[Facilitator] Running at ${facilitator.url}`);
}

// ============================================================================
// Hono App Setup
// ============================================================================

const app = new Hono<Env>();

// ============================================================================
// Middleware
// ============================================================================

// Payment middleware for protected routes
const requirePayment = honoPaymentMiddleware({
  requirements: PAYMENT_REQUIREMENTS,

  // Facilitator URL (optional - for remote verification)
  facilitatorUrl: facilitatorEnabled
    ? `http://localhost:${FACILITATOR_PORT}`
    : undefined,

  // Verify options (optional)
  verifyOptions: {
    skipBalanceCheck: false,
    skipNonceCheck: false,
  },

  // Skip verification (for testing only)
  skipVerification: process.env.SKIP_VERIFICATION === "true",
});

// CORS middleware
app.use("*", async (c, next) => {
  c.header("Access-Control-Allow-Origin", "*");
  c.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  c.header("Access-Control-Allow-Headers", "*");

  if (c.req.method === "OPTIONS") {
    return c.text("", 204);
  }

  await next();
});

// ============================================================================
// Routes
// ============================================================================

/**
 * GET / - Health check
 * Public route - no payment required
 */
app.get("/", (c) => {
  return c.json({
    status: "ok",
    message: "Hono server with X-402 payment middleware",
    timestamp: Date.now(),
  });
});

/**
 * GET /api/public - Public endpoint
 * No payment required
 */
app.get("/api/public", (c) => {
  return c.json({
    message: "This is a public endpoint - no payment required",
    data: {
      info: "Anyone can access this route",
    },
  });
});

/**
 * GET /api/requirements - Get payment requirements
 * Returns the payment requirements for the protected route
 */
app.get("/api/requirements", (c) => {
  return c.json({
    requirements: PAYMENT_REQUIREMENTS,
    instructions: {
      header: "PAYMENT-SIGNATURE",
      format: "JSON string with signature",
      example: {
        from: "0x...",
        to: PAY_TO_ADDRESS,
        amount: "1000000",
        chainId: "eip155:8453",
        assetId: "eip155:8453/erc20:0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
        expiry: Math.floor(Date.now() / 1000) + 3600,
        nonce: "0x...",
        signatures: ["0x..."],
      },
    },
  });
});

/**
 * GET /api/protected - Protected endpoint
 * Requires valid payment in PAYMENT-SIGNATURE header
 */
app.get("/api/protected", requirePayment, (c) => {
  const payment = c.get("payment");

  return c.json({
    message: "Payment verified - access granted",
    payment: {
      payerAddress: payment.payerAddress,
      version: payment.version,
      verified: payment.verified,
      amount: PAYMENT_REQUIREMENTS.amount,
      asset: PAYMENT_REQUIREMENTS.assetId,
    },
    data: {
      info: "This is protected content",
      timestamp: Date.now(),
    },
  });
});

/**
 * POST /api/protected - Protected endpoint (POST)
 * Requires valid payment
 */
app.post("/api/protected", requirePayment, async (c) => {
  const payment = c.get("payment");
  const body = await c.json().catch(() => ({}));

  return c.json({
    message: "Payment verified - POST request accepted",
    payment: {
      payerAddress: payment.payerAddress,
      version: payment.version,
    },
    received: body,
  });
});

/**
 * GET /api/premium - Premium endpoint (higher payment)
 * Requires larger payment amount
 */
app.get(
  "/api/premium",
  honoPaymentMiddleware({
    requirements: {
      ...PAYMENT_REQUIREMENTS,
      amount: "5000000", // 5 USDC
    },
    facilitatorUrl: facilitatorEnabled
      ? `http://localhost:${FACILITATOR_PORT}`
      : undefined,
  }),
  (c) => {
    const payment = c.get("payment");

    return c.json({
      message: "Premium payment verified",
      payment: {
        payerAddress: payment.payerAddress,
        amount: "5000000", // 5 USDC
      },
      data: {
        info: "This is premium content with higher payment requirement",
        features: ["feature1", "feature2", "feature3"],
      },
    });
  },
);

// ============================================================================
// Server Start
// ============================================================================

Bun.serve({
  port: PORT,
  fetch: app.fetch,
});

console.log(`
╔═══════════════════════════════════════════════════════════════╗
║                   Hono X-402 Server Started                  ║
╠═══════════════════════════════════════════════════════════════╣
║  Server URL:     http://localhost:${PORT}                       ║
║  Facilitator:     ${facilitatorEnabled ? `http://localhost:${FACILITATOR_PORT}` : "Disabled"}              ║
║                                                               ║
║  Routes:                                                       ║
║    GET  /                  - Health check                     ║
║    GET  /api/public        - Public endpoint                  ║
║    GET  /api/requirements  - Payment requirements             ║
║    GET  /api/protected     - Protected (1 USDC)               ║
║    POST /api/protected     - Protected (1 USDC)               ║
║    GET  /api/premium       - Premium (5 USDC)                 ║
║                                                               ║
║  Payment Protocol: V2 (PAYMENT-SIGNATURE)                     ║
║  Network:          Base (eip155:8453)                         ║
║  Asset:            USDC                                       ║
╚═══════════════════════════════════════════════════════════════╝
`);

// Type-safe client export (for testing)
export type AppType = typeof app;

// Create client for testing
export const client = hc<AppType>(`http://localhost:${PORT}`);
