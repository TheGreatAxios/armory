/**
 * Test script for Hono X-402 server
 *
 * Run with: bun run test.ts
 */

export {}; /**
 * Test script for Hono X-402 server
 *
 * Run with: bun run test.ts
 */

const API_URL = "http://localhost:3001";

async function testPublicRoute() {
  console.log("\n[TEST] GET /api/public (public route)");
  const response = await fetch(`${API_URL}/api/public`);
  const data = await response.json();
  console.log("Status:", response.status);
  console.log("Response:", data);
  return response.status === 200;
}

async function testProtectedWithoutPayment() {
  console.log("\n[TEST] GET /api/protected (without payment)");
  const response = await fetch(`${API_URL}/api/protected`);
  console.log("Status:", response.status);
  console.log("Headers:", Object.fromEntries(response.headers.entries()));

  if (response.status === 402) {
    const paymentRequired = response.headers.get("PAYMENT-REQUIRED");
    if (paymentRequired) {
      console.log("Payment Required:", JSON.parse(paymentRequired));
    }
  }
  return response.status === 402;
}

async function testRequirements() {
  console.log("\n[TEST] GET /api/requirements");
  const response = await fetch(`${API_URL}/api/requirements`);
  const data = await response.json();
  console.log("Status:", response.status);
  console.log("Response:", JSON.stringify(data, null, 2));
  return response.status === 200;
}

async function testHealth() {
  console.log("\n[TEST] GET / (health check)");
  const response = await fetch(`${API_URL}/`);
  const data = await response.json();
  console.log("Status:", response.status);
  console.log("Response:", data);
  return response.status === 200;
}

async function runTests() {
  console.log("=".repeat(60));
  console.log("Hono X-402 Server Tests");
  console.log("=".repeat(60));

  const results = {
    health: await testHealth(),
    public: await testPublicRoute(),
    protected402: await testProtectedWithoutPayment(),
    requirements: await testRequirements(),
  };

  console.log(`\n${"=".repeat(60)}`);
  console.log("Test Results:");
  console.log("=".repeat(60));
  Object.entries(results).forEach(([name, passed]) => {
    console.log(`${name.padEnd(15)} ${passed ? "✓ PASS" : "✗ FAIL"}`);
  });

  const allPassed = Object.values(results).every((r) => r);
  console.log("=".repeat(60));
  console.log(allPassed ? "All tests passed!" : "Some tests failed!");
  console.log("=".repeat(60));

  process.exit(allPassed ? 0 : 1);
}

// Run tests
runTests().catch((error) => {
  console.error("Test error:", error);
  process.exit(1);
});
