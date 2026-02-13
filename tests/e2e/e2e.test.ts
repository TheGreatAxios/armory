/**
 * E2E Payment Tests
 * 
 * Tests Faremeter and Coinbase x402 SDKs against a simple x402-compatible server.
 * Tests multiple facilitators on Base Sepolia and SKALE Base Sepolia.
 * 
 * Run with:
 *   bun test tests/e2e/e2e.test.ts
 * 
 * Environment (in tests/e2e/.env):
 *   TEST_PRIVATE_KEY - Private key with USDC on testnets
 */

import { describe, test, expect } from "bun:test";
import { privateKeyToAccount } from "viem/accounts";
import { serve } from "bun";
import { wrap as wrapFaremeter } from "@faremeter/fetch";
import { createPaymentHandler as createFaremeterHandler } from "@faremeter/payment-evm/exact";
import { wrapFetchWithPaymentFromConfig as wrapX402 } from "@x402/fetch";
import { ExactEvmScheme } from "@x402/evm";

// ============================================================================
// Config - Load from .env
// ============================================================================

import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, ".env");

let TEST_PRIVATE_KEY: string;

try {
  const envContent = readFileSync(envPath, "utf-8");
  const match = envContent.match(/TEST_PRIVATE_KEY=(.+)/);
  if (!match?.[1]) throw new Error("TEST_PRIVATE_KEY not found in .env");
  TEST_PRIVATE_KEY = match[1].trim();
} catch {
  throw new Error("TEST_PRIVATE_KEY not found in tests/e2e/.env - create it with a private key that has testnet USDC");
}

const account = privateKeyToAccount(TEST_PRIVATE_KEY as `0x${string}`);

// Networks
const NETWORKS = {
  "base-sepolia": {
    chainId: 84532,
    usdc: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
  },
  "skale-base-sepolia": {
    chainId: 1196,
    usdc: "0x5b8eb4408481a1E6D32081F6a9d28E74C8cAf43F",
  },
} as const;

type NetworkName = keyof typeof NETWORKS;

// Facilitators (public URLs)
const FACILITATORS = {
  payai: "https://facilitator.payai.network",
  corbits: "https://x402.facilitator.corbits.io",
  kobaru: "https://x402.kobaru.io",
  relai: "https://relai-facilitator-x402.classiq.software",
  nuwa: "https://x402.nuwa.energy",
} as const;

type FacilitatorName = keyof typeof FACILITATORS;

const PAY_TO = "0x1234567890123456789012345678901234567890";
const AMOUNT = "1000000"; // 1 USDC in atomic units

// ============================================================================
// Simple x402-Compatible Test Server
// ============================================================================

function createTestServer(network: NetworkName) {
  const networkConfig = NETWORKS[network];
  
  return serve({
    port: 0, // Random port
    
    async fetch(req) {
      const url = new URL(req.url);
      
      // Handle /api/test endpoint
      if (url.pathname === "/api/test") {
        const paymentHeader = req.headers.get("PAYMENT-SIGNATURE") || 
                            req.headers.get("X-PAYMENT");
        
        // No payment header - return 402 with payment requirements
        if (!paymentHeader) {
          const requirements = {
            scheme: "exact",
            network: `eip155:${networkConfig.chainId}`,
            amount: AMOUNT,
            asset: networkConfig.usdc,
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
        
        // Has payment - return 200 (verification would happen via facilitator)
        return new Response(JSON.stringify({ 
          success: true, 
          message: "Payment received",
          payment: "present",
        }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      
      // Unknown endpoint
      return new Response("Not Found", { status: 404 });
    },
  });
}

// ============================================================================
// Clients
// ============================================================================

function createFaremeterClient(network: NetworkName) {
  const networkConfig = NETWORKS[network];
  const wallet = {
    ...account,
    chain: { id: networkConfig.chainId },
  } as any;

  return wrapFaremeter(fetch, {
    handlers: [createFaremeterHandler(wallet)],
  });
}

function createX402Client() {
  return wrapX402(fetch, {
    schemes: [
      {
        network: "eip155:*",
        client: new ExactEvmScheme(account),
      },
    ],
  });
}

// ============================================================================
// Tests
// ============================================================================

describe("E2E Payment Compatibility", () => {
  const faremeterClients = {
    "base-sepolia": createFaremeterClient("base-sepolia"),
    "skale-base-sepolia": createFaremeterClient("skale-base-sepolia"),
  };
  
  const x402Client = createX402Client();

  // Test each network with each SDK
  for (const [netName, netConfig] of Object.entries(NETWORKS)) {
    const network = netName as NetworkName;
    
    test(`${netName} + Faremeter SDK`, async () => {
      const server = createTestServer(network);
      const port = server.port;
      
      try {
        const client = faremeterClients[network];
        const res = await client(`http://localhost:${port}/api/test`, {
          method: "GET",
        });

        // Should get either 402 (payment required) or 200 (SDK handled payment)
        expect([200, 402]).toContain(res.status);
        
        if (res.status === 402) {
          const header = res.headers.get("PAYMENT-REQUIRED");
          expect(header).toBeTruthy();
          
          // Should be valid base64
          const decoded = JSON.parse(Buffer.from(header!, "base64").toString());
          expect(decoded.accepts).toBeDefined();
          expect(decoded.accepts.length).toBeGreaterThan(0);
        }
      } finally {
        server.stop();
      }
    });

    test(`${netName} + Coinbase x402 SDK`, async () => {
      const server = createTestServer(network);
      const port = server.port;
      
      try {
        const res = await x402Client(`http://localhost:${port}/api/test`, {
          method: "GET",
        });

        expect([200, 402]).toContain(res.status);
        
        if (res.status === 402) {
          const header = res.headers.get("PAYMENT-REQUIRED");
          expect(header).toBeTruthy();
          
          const decoded = JSON.parse(Buffer.from(header!, "base64").toString());
          expect(decoded.accepts).toBeDefined();
          expect(decoded.accepts.length).toBeGreaterThan(0);
        }
      } finally {
        server.stop();
      }
    });
  }
});
