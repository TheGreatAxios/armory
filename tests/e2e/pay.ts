#!/usr/bin/env bun
/**
 * Live Payment Test
 *
 * Executes real transactions on base-sepolia using TEST_PRIVATE_KEY.
 *
 * Usage:
 *   TEST_PRIVATE_KEY=0x... bun run test:pay
 *
 * Tests all 8 combinations:
 *   Hono × Faremeter/x402 (2)
 *   Express × Faremeter/x402 (2)
 *   Elysia × Faremeter/x402 (2)
 *   Bun × Faremeter/x402 (2)
 */

import {
  TEST_PRIVATE_KEY,
  TEST_PAY_TO_ADDRESS,
  TEST_AMOUNT,
  TEST_NETWORK,
  TEST_CHAIN_ID,
  FACILITATOR_URL,
} from "./config";
import {
  createHonoServer,
  createExpressServer,
  createElysiaServer,
  createBunServer,
} from "./servers";
import { createFaremeterClient, createX402Client } from "./clients";

// Validate private key
if (!TEST_PRIVATE_KEY || TEST_PRIVATE_KEY.startsWith("0x0000")) {
  console.error("ERROR: TEST_PRIVATE_KEY required with a valid private key");
  console.error("Usage: TEST_PRIVATE_KEY=0x... bun run test:pay");
  process.exit(1);
}

const serverConfig = {
  payTo: TEST_PAY_TO_ADDRESS,
  amount: TEST_AMOUNT,
  network: TEST_NETWORK,
};

const clientConfig = {
  privateKey: TEST_PRIVATE_KEY,
  chainId: TEST_CHAIN_ID,
  baseUrl: "", // Will be set per test
};

// Test combinations
const combinations = [
  { name: "Hono + Faremeter", server: createHonoServer, client: createFaremeterClient },
  { name: "Hono + x402", server: createHonoServer, client: createX402Client },
  { name: "Express + Faremeter", server: createExpressServer, client: createFaremeterClient },
  { name: "Express + x402", server: createExpressServer, client: createX402Client },
  { name: "Elysia + Faremeter", server: createElysiaServer, client: createFaremeterClient },
  { name: "Elysia + x402", server: createElysiaServer, client: createX402Client },
  { name: "Bun + Faremeter", server: createBunServer, client: createFaremeterClient },
  { name: "Bun + x402", server: createBunServer, client: createX402Client },
];

async function runPaymentTest(
  name: string,
  serverFactory: typeof createHonoServer,
  clientFactory: typeof createFaremeterClient
): Promise<void> {
  console.log(`\n🧪 Testing: ${name}`);
  console.log("─".repeat(50));

  try {
    // Start server
    const server = await serverFactory(serverConfig);
    console.log(`✓ Server started on ${server.url}`);

    // Create client
    const client = await clientFactory({ ...clientConfig, baseUrl: server.url });
    console.log("✓ Client created");

    // Execute payment
    const response = await client.fetch(`${server.url}/api/test`);
    console.log(`✓ Request sent, status: ${response.status}`);

    const body = await response.json();
    console.log("✓ Response:", JSON.stringify(body, null, 2));

    // Close server
    await server.close();
    console.log("✓ Server closed");

    console.log(`✅ ${name} - SUCCESS`);
  } catch (error) {
    console.error(`❌ ${name} - FAILED:`, error instanceof Error ? error.message : error);
    throw error;
  }
}

async function main() {
  console.log("╔════════════════════════════════════════════════════════════╗");
  console.log("║           Live Payment Test - base-sepolia                 ║");
  console.log("╚════════════════════════════════════════════════════════════╝");
  console.log(`Network: ${TEST_NETWORK}`);
  console.log(`Chain ID: ${TEST_CHAIN_ID}`);
  console.log(`Amount: ${TEST_AMOUNT}`);
  console.log(`Pay To: ${TEST_PAY_TO_ADDRESS}`);
  console.log(`Facilitator: ${FACILITATOR_URL}`);

  const results: Array<{ name: string; success: boolean; error?: string }> = [];

  for (const combo of combinations) {
    try {
      await runPaymentTest(combo.name, combo.server, combo.client);
      results.push({ name: combo.name, success: true });
    } catch (error) {
      results.push({
        name: combo.name,
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // Summary
  console.log("\n╔════════════════════════════════════════════════════════════╗");
  console.log("║                         Summary                             ║");
  console.log("╚════════════════════════════════════════════════════════════╝");

  const passed = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;

  for (const result of results) {
    const status = result.success ? "✅ PASS" : "❌ FAIL";
    console.log(`${status} - ${result.name}`);
    if (result.error) {
      console.log(`        Error: ${result.error}`);
    }
  }

  console.log("\n" + "─".repeat(50));
  console.log(`Total: ${results.length} | Passed: ${passed} | Failed: ${failed}`);

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
