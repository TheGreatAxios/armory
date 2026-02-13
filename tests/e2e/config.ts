/**
 * E2E Test Scripts for Armory Middleware
 * 
 * Tests cross-compatibility with:
 * - Faremeter SDK (@faremeter/fetch)
 * - Coinbase x402 SDK (@x402/fetch)
 * 
 * Usage:
 *   # Run tests against your server
 *   TEST_PRIVATE_KEY=0x... bun x tests/e2e/test-faremeter.ts
 *   TEST_PRIVATE_KEY=0x... bun x tests/e2e/test-coinbase.ts
 * 
 * Environment:
 *   TEST_PRIVATE_KEY  - Private key with testnet USDC (required)
 *   SERVER_URL       - Server URL (default: http://localhost:8787)
 */

export const E2E_CONFIG = {
  defaultServerUrl: "http://localhost:8787",
  testEndpoints: {
    test: "/api/test",
    premium: "/api/premium",
  },
  expectedNetworks: {
    baseSepolia: "eip155:84532",
    base: "eip155:8453",
  },
};
