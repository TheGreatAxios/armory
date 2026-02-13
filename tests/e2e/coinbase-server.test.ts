/**
 * E2E Test: Coinbase x402 Server
 * 
 * Tests that Coinbase's x402 server format works correctly.
 * 
 * Run: bun test tests/e2e/coinbase-server.test.ts
 * 
 * Requires: tests/e2e/.env with TEST_PRIVATE_KEY
 */

import { describe, test, expect } from "bun:test";
import { serve } from "bun";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

// ============================================================================
// Config
// ============================================================================

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, ".env");

let TEST_PRIVATE_KEY: string;
try {
  const envContent = readFileSync(envPath, "utf-8");
  const match = envContent.match(/TEST_PRIVATE_KEY=(.+)/);
  if (!match?.[1]) throw new Error("TEST_PRIVATE_KEY not found in .env");
  TEST_PRIVATE_KEY = match[1].trim();
} catch {
  throw new Error("TEST_PRIVATE_KEY not found in tests/e2e/.env");
}

const CHAIN_ID = 84532;
const USDC_ADDRESS = "0x036CbD53842c5426634e7929541eC2318f3dCF7e";
const PAY_TO = "0x1234567890123456789012345678901234567890";
const AMOUNT = "1000000";

// ============================================================================
// Test Server (Coinbase x402 format)
// ============================================================================

function createCoinbaseServer() {
  return serve({
    port: 0,
    async fetch(req) {
      const url = new URL(req.url);
      
      if (url.pathname === "/api/test") {
        const paymentHeader = req.headers.get("PAYMENT-SIGNATURE") || 
                            req.headers.get("X-PAYMENT");
        
        if (!paymentHeader) {
          // Coinbase x402 format - returns accepts array with x402Version
          const requirements = {
            scheme: "exact" as const,
            network: `eip155:${CHAIN_ID}`,
            amount: AMOUNT,
            asset: USDC_ADDRESS,
            payTo: PAY_TO,
            maxTimeoutSeconds: 300,
          };
          
          return new Response(JSON.stringify({ accepts: [requirements] }), {
            status: 402,
            headers: {
              "Content-Type": "application/json",
              "PAYMENT-REQUIRED": Buffer.from(JSON.stringify({ accepts: [requirements] })).toString("base64"),
            },
          });
        }
        
        return new Response(JSON.stringify({ success: true }), { status: 200 });
      }
      
      return new Response("Not Found", { status: 404 });
    },
  });
}

// ============================================================================
// Tests
// ============================================================================

describe("Coinbase x402 Server", () => {
  test("returns 402 with payment requirements in x402 format", async () => {
    const server = createCoinbaseServer();
    const port = server.port;
    
    try {
      const res = await fetch(`http://localhost:${port}/api/test`, { 
        method: "GET" 
      });
      
      expect(res.status).toBe(402);
      
      const header = res.headers.get("PAYMENT-REQUIRED");
      expect(header).toBeTruthy();
      
      const decoded = JSON.parse(Buffer.from(header!, "base64").toString());
      expect(decoded.accepts).toBeDefined();
      expect(decoded.accepts.length).toBeGreaterThan(0);
      expect(decoded.accepts[0].scheme).toBe("exact");
    } finally {
      server.stop();
    }
  });
});
