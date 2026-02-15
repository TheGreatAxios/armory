/**
 * Express Server with X-402 Payment Middleware
 *
 * This example demonstrates:
 * - Setting up an Express server with X-402 payment middleware
 * - Protected routes requiring payment
 * - Public routes accessible without payment
 * - Returning 402 with payment requirements
 * - Facilitator integration for payment verification
 */

import express from "express";
import type { PaymentRequirementsV2 } from "@armory/base";
import { paymentMiddleware, type AugmentedRequest } from "@armory/middleware";

// ============================================================================
// Configuration
// ============================================================================

const PORT = parseInt(process.env.PORT || "3000");
const FACILITATOR_URL = process.env.FACILITATOR_URL;

// Payment recipient address (replace with your own)
const PAYMENT_RECIPIENT = process.env.PAYMENT_RECIPIENT || "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb";

// ============================================================================
// Payment Requirements
// ============================================================================

/**
 * Payment requirements for protected routes
 * Using Base mainnet USDC for this example
 */
const PAYMENT_REQUIREMENTS: PaymentRequirementsV2 = {
  amount: "1000000", // 1 USDC (6 decimals)
  to: PAYMENT_RECIPIENT,
  chainId: "eip155:8453", // Base mainnet
  assetId: "eip155:8453/erc20:0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", // Base USDC
  nonce: crypto.randomUUID(),
  expiry: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
};

// ============================================================================
// Express App Setup
// ============================================================================

const app = express();

// Parse JSON bodies
app.use(express.json());

// ============================================================================
// Public Routes (No Payment Required)
// ============================================================================

/**
 * Health check endpoint - always accessible
 */
app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    service: "armory-express-example",
  });
});

/**
 * Public information endpoint
 * Demonstrates a route that doesn't require payment
 */
app.get("/api/info", (_req, res) => {
  res.json({
    message: "This is a public endpoint",
    paymentRequired: false,
    endpoints: {
      public: ["/health", "/api/info"],
      protected: ["/api/protected", "/api/premium-content"],
    },
  });
});

/**
 * Get payment requirements without making a payment
 * Useful for clients to preview what payment is needed
 */
app.get("/api/payment-requirements", (_req, res) => {
  res.json({
    requirements: PAYMENT_REQUIREMENTS,
    network: "Base Mainnet",
    token: "USDC",
    amount: "1.00",
  });
});

// ============================================================================
// Protected Routes (Payment Required)
// ============================================================================

/**
 * Protected route using payment middleware
 * Returns 402 with payment requirements if payment is missing/invalid
 */
app.get(
  "/api/protected",
  paymentMiddleware({
    requirements: PAYMENT_REQUIREMENTS,
    facilitatorUrl: FACILITATOR_URL,
  }),
  (req: AugmentedRequest, res) => {
    // Payment info is attached to req.payment by the middleware
    const { payment } = req;

    res.json({
      message: "Access granted to protected content",
      payment: {
        verified: payment?.verified,
        payerAddress: payment?.payerAddress,
        version: payment?.version,
      },
      data: {
        content: "This is premium content only accessible with valid payment",
        timestamp: new Date().toISOString(),
      },
    });
  }
);

/**
 * Premium content endpoint with higher payment requirement
 */
app.get(
  "/api/premium-content",
  paymentMiddleware({
    requirements: {
      ...PAYMENT_REQUIREMENTS,
      amount: "5000000", // 5 USDC
      nonce: crypto.randomUUID(),
    },
    facilitatorUrl: FACILITATOR_URL,
  }),
  (req: AugmentedRequest, res) => {
    res.json({
      message: "Access granted to premium content",
      payment: {
        verified: req.payment?.verified,
        payerAddress: req.payment?.payerAddress,
      },
      data: {
        tier: "premium",
        features: [
          "Full API access",
          "Priority support",
          "Advanced analytics",
          "Custom integrations",
        ],
      },
    });
  }
);

/**
 * POST endpoint for paid actions
 * Demonstrates payment-protected mutations
 */
app.post(
  "/api/actions/generate",
  paymentMiddleware({
    requirements: PAYMENT_REQUIREMENTS,
    facilitatorUrl: FACILITATOR_URL,
  }),
  (req: AugmentedRequest, res) => {
    const { prompt } = req.body as { prompt?: string };

    res.json({
      message: "Action completed",
      payment: {
        verified: req.payment?.verified,
        payerAddress: req.payment?.payerAddress,
      },
      result: {
        id: crypto.randomUUID(),
        prompt: prompt || "No prompt provided",
        generated: "Sample generated content for paid action",
        timestamp: new Date().toISOString(),
      },
    });
  }
);

// ============================================================================
// Facilitator Integration (Optional)
// ============================================================================

/**
 * Start a local facilitator server for payment verification
 * This is optional - you can also use a remote facilitator service
 */
async function startFacilitator() {
  const { createFacilitatorServer } = await import("@armory/facilitator");

  const facilitator = createFacilitatorServer({
    port: 3001,
    queue: "memory",
    nonceTracker: "memory",
    networks: ["base-sepolia"], // Use testnet for development
  });

  await facilitator.start();
  console.log("Facilitator server running on http://localhost:3001");

  return facilitator;
}

// ============================================================================
// Server Startup
// ============================================================================

async function main() {
  // Optional: Start local facilitator if no URL is provided
  let facilitator: Awaited<ReturnType<typeof startFacilitator>> | undefined;

  if (!FACILITATOR_URL) {
    console.log("No FACILITATOR_URL provided, starting local facilitator...");
    facilitator = await startFacilitator();
  }

  // Start Express server
  app.listen(PORT, () => {
    console.log(`
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║   Armory X-402 Express Server Example                        ║
║                                                               ║
║   Server: http://localhost:${PORT}                           ║
║   Health: http://localhost:${PORT}/health                    ║
║                                                               ║
║   Public Routes:                                              ║
║     - GET /api/info                                           ║
║     - GET /api/payment-requirements                           ║
║                                                               ║
║   Protected Routes (Requires X-402 Payment):                  ║
║     - GET /api/protected                                      ║
║     - GET /api/premium-content                                ║
║     - POST /api/actions/generate                              ║
║                                                               ║
║   Payment Requirements:                                       ║
║     - Network: Base Mainnet                                   ║
║     - Token: USDC                                             ║
║     - Amount: 1 USDC (protected) / 5 USDC (premium)          ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
    `);

    if (!FACILITATOR_URL) {
      console.log("Facilitator: Running locally on http://localhost:3001");
    } else {
      console.log(`Facilitator: Using remote service at ${FACILITATOR_URL}`);
    }
  });

  // Graceful shutdown
  process.on("SIGINT", async () => {
    console.log("\nShutting down...");
    await facilitator?.stop();
    process.exit(0);
  });
}

main().catch(console.error);
