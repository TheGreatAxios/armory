/**
 * Standard X-402 Facilitator Server
 *
 * Production-ready facilitator with:
 * - Health check endpoint
 * - Payment verification endpoint
 * - Payment settlement endpoint
 * - Supported networks endpoint
 * - Background queue worker
 * - In-memory nonce tracking
 */

import {
  createFacilitatorServer,
  createMemoryQueue,
  createNonceTracker,
} from "@armory/facilitator";

// ============================================================================
// Configuration
// ============================================================================

const PORT = Number.parseInt(process.env.PORT ?? "3000", 10);
const HOST = process.env.HOST ?? "0.0.0.0";

// Private key for signing transactions (optional)
// If not provided, settlement will be simulated
const PRIVATE_KEY = process.env.PRIVATE_KEY as `0x${string}` | undefined;

// RPC URLs for supported networks
const RPC_URLS: Record<number, string> = {
  1: process.env.RPC_ETHEREUM ?? "https://eth.llamarpc.com",
  8453: process.env.RPC_BASE ?? "https://mainnet.base.org",
  10: process.env.RPC_OPTIMISM ?? "https://mainnet.optimism.io",
  42161: process.env.RPC_ARBITRUM ?? "https://arb1.arbitrum.io/rpc",
  137: process.env.RPC_POLYGON ?? "https://polygon-rpc.com",
};

// Queue configuration
const QUEUE_POLL_INTERVAL = Number.parseInt(process.env.QUEUE_POLL_INTERVAL ?? "1000", 10);
const QUEUE_MAX_RETRIES = Number.parseInt(process.env.QUEUE_MAX_RETRIES ?? "3", 10);

// Nonce tracker configuration (TTL in milliseconds, undefined = no expiration)
const NONCE_TTL = process.env.NONCE_TTL
  ? Number.parseInt(process.env.NONCE_TTL, 10)
  : undefined;

// ============================================================================
// Initialize Services
// ============================================================================

console.log("Initializing facilitator services...");

// Create in-memory payment queue
const paymentQueue = createMemoryQueue({
  maxRetries: QUEUE_MAX_RETRIES,
  retryDelay: 1000,
});

// Create in-memory nonce tracker
const nonceTracker = createNonceTracker({
  ttl: NONCE_TTL,
  cleanupInterval: 60000,
});

console.log("Services initialized:");
console.log("  - Payment Queue: in-memory");
console.log("  - Nonce Tracker: in-memory");
console.log("  - Settlement Mode:", PRIVATE_KEY ? "live" : "simulated");

// ============================================================================
// Start Server
// ============================================================================

const server = createFacilitatorServer({
  port: PORT,
  host: HOST,
  nonceTracker,
  paymentQueue,
  rpcUrls: RPC_URLS,
  privateKey: PRIVATE_KEY,
  queuePollInterval: QUEUE_POLL_INTERVAL,
});

console.log(`
╔════════════════════════════════════════════════════════════╗
║           X-402 Facilitator Server Started                 ║
╠════════════════════════════════════════════════════════════╣
║  URL:        ${server.url.padEnd(47)}║
║  Port:       ${String(server.port).padEnd(47)}║
║  Settlement: ${PRIVATE_KEY ? "LIVE".padEnd(43) : "SIMULATED".padEnd(43)}║
╠════════════════════════════════════════════════════════════╣
║  Endpoints:                                               ║
║    GET  /health          - Health check & queue stats     ║
║    GET  /supported       - List supported networks        ║
║    POST /verify          - Verify payment                 ║
║    POST /settle          - Settle payment (async)         ║
╚════════════════════════════════════════════════════════════╝
`);

// ============================================================================
// Graceful Shutdown
// ============================================================================

const shutdown = (signal: string) => {
  console.log(`\nReceived ${signal}, shutting down gracefully...`);

  // Stop the server
  server.stop();

  // Close the nonce tracker
  nonceTracker.close();

  // Close the queue
  paymentQueue.close();

  console.log("Facilitator stopped.");
  process.exit(0);
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

// Keep process alive
process.on("uncaughtException", (error) => {
  console.error("Uncaught exception:", error);
  shutdown("UNCAUGHT_EXCEPTION");
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled rejection at:", promise, "reason:", reason);
  shutdown("UNHANDLED_REJECTION");
});
