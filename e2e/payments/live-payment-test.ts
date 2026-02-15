#!/usr/bin/env bun
/**
 * Live Payment Test
 *
 * Executes real transactions on base-sepolia using TEST_PRIVATE_KEY.
 *
 * Usage:
 *   TEST_PRIVATE_KEY=0x... bun run test:pay
 *
 * Tests x402 SDK compatibility:
 *   Hono + x402 (V2)
 *   Express + x402 (V2)
 */

import {
  TEST_PRIVATE_KEY,
  TEST_PAY_TO_ADDRESS,
  TEST_AMOUNT,
  TEST_NETWORK,
  TEST_CHAIN_ID,
  FACILITATOR_URL,
} from "../general/config";
import {
  createHonoServer,
  createExpressServer,
} from "../general/servers";

// Import x402 client functions
async function createX402Client(config: any) {
  const { wrapFetchWithPayment, x402Client } = await import("@x402/fetch");
  const { ExactEvmScheme } = await import("@x402/evm");
  const { privateKeyToAccount } = await import("viem/accounts");

  const account = privateKeyToAccount(config.privateKey);

  const client = new x402Client()
    .register(`eip155:${config.chainId}`, new ExactEvmScheme(account), 2);
  const fetchWithPayment = wrapFetchWithPayment(fetch, client);

  return { fetch: fetchWithPayment };
}

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
  version: 2 as const,
};

const clientConfig = {
  privateKey: TEST_PRIVATE_KEY,
  chainId: TEST_CHAIN_ID,
  baseUrl: "", // Will be set per test
};

// Test combinations - x402 only
const combinations = [
  { name: "Hono + x402", server: createHonoServer },
  { name: "Express + x402", server: createExpressServer },
];

async function runPaymentTest(
  name: string,
  serverFactory: typeof createHonoServer | typeof createExpressServer,
): Promise<void> {
  console.log(`\n🧪 Testing: ${name}`);
  console.log("─".repeat(50));

  let server: Awaited<ReturnType<typeof createHonoServer>> | null = null;

  try {
    // Start server
    server = await serverFactory(serverConfig);
    console.log(`✓ Server started on ${server.url}`);

    // Create x402 client
    const client = await createX402Client({ ...clientConfig, baseUrl: server.url });
    console.log("✓ Client created");

    // Execute payment
    const response = await client.fetch(`${server.url}/api/test`);
    console.log(`✓ Request sent, status: ${response.status}`);

    const body = await response.json();
    console.log("✓ Response:", JSON.stringify(body, null, 2));

    console.log(`✅ ${name} - SUCCESS`);
  } catch (error) {
    console.error(`❌ ${name} - FAILED:`, error instanceof Error ? error.message : error);
    throw error;
  } finally {
    // Always close the server, even if test failed
    if (server) {
      try {
        await server.close();
        console.log("✓ Server closed");
      } catch {
        // Ignore close errors
      }
    }
  }
}

async function main() {
  console.log("╔══════════════════════════════════════════════════════╗");
  console.log("║           Live Payment Test - base-sepolia                 ║");
  console.log("╚══════════════════════════════════════════════════════════╝");
  console.log(`Network: ${TEST_NETWORK}`);
  console.log(`Chain ID: ${TEST_CHAIN_ID}`);
  console.log(`Amount: ${TEST_AMOUNT}`);
  console.log(`Pay To: ${TEST_PAY_TO_ADDRESS}`);
  console.log(`Facilitator: ${FACILITATOR_URL}`);

  const results: Array<{ name: string; success: boolean; error?: string }> = [];

  for (const combo of combinations) {
    try {
      await runPaymentTest(combo.name, combo.server);
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
  console.log("\n╔════════════════════════════════════════════════════╗");
  console.log("║                         Summary                             ║");
  console.log("╚════════════════════════════════════════════════════╝");

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
