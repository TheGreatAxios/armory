/**
 * E2E Test Runner
 * 
 * Starts a test server and runs E2E tests against it
 * 
 * Usage:
 *   bun run test:e2e                    # Run all e2e tests
 *   bun run test:e2e:faremeter          # Run only Faremeter test
 *   bun run test:e2e:coinbase           # Run only Coinbase test
 *   bun run test:e2e:server             # Start server only
 * 
 * Environment:
 *   TEST_PRIVATE_KEY - Private key with Base Sepolia USDC
 *   SERVER_PORT - Port for test server (default: 8787)
 */

import { serve } from "@hono/node-server";
import { createTestServer } from "./server";

const PORT = parseInt(process.env.SERVER_PORT || "8787");

async function startServer() {
  const app = createTestServer();
  
  console.log(`🚀 Starting test server on port ${PORT}...`);
  console.log(`   Test endpoints:`);
  console.log(`   - GET http://localhost:${PORT}/api/test`);
  console.log(`   - GET http://localhost:${PORT}/api/premium`);
  
  serve({
    fetch: app.fetch,
    port: PORT,
  });
  
  console.log(`\n✅ Server running at http://localhost:${PORT}`);
  console.log(`   Press Ctrl+C to stop\n`);
}

const command = process.argv[2];

switch (command) {
  case "server":
    startServer();
    break;
  case "faremeter":
    console.log("📦 Running Faremeter test...");
    console.log("   (Start server with: bun run test:e2e:server)");
    console.log("   Then run: bun run tests/e2e/test-faremeter.ts\n");
    // Import and run the test
    import("./test-faremeter.ts").catch(console.error);
    break;
  case "coinbase":
    console.log("📦 Running Coinbase x402 test...");
    console.log("   (Start server with: bun run test:e2e:server)");
    console.log("   Then run: bun run tests/e2e/test-coinbase.ts\n");
    import("./test-coinbase.ts").catch(console.error);
    break;
  case "server &":
    // Background server start
    startServer();
    break;
  default:
    console.log("🧪 Armory E2E Test Suite");
    console.log("=".repeat(50));
    console.log("\nUsage:");
    console.log("  bun run test:e2e:server     # Start test server");
    console.log("  bun x tests/e2e/test-faremeter.ts   # Run Faremeter test");
    console.log("  bun x tests/e2e/test-coinbase.ts   # Run Coinbase test");
    console.log("\nEnvironment:");
    console.log("  TEST_PRIVATE_KEY  # Private key with Base Sepolia USDC");
    console.log("  SERVER_PORT       # Server port (default: 8787)");
}
