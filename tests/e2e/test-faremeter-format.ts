#!/usr/bin/env bun
/**
 * Test if middleware returns correct Faremeter V1 format
 */

import { acceptPaymentsViaArmory } from "../packages/middleware-hono/src/index";

const serverConfig = {
  payTo: "0x123456789012345678901234567890",
  amount: "1000000",
  network: "base-sepolia",
};

async function main() {
  const app = new Hono();

  app.use("/*", acceptPaymentsViaArmory(serverConfig));

  app.get("/api/test", (c) => {
    const payment = c.get("payment");

    if (!payment) {
      // Should return 402 with payment required
      return c.json({
        error: "No payment found",
        middleware: "hono",
      });
    }

    // Should return 200 with payment verified
    return c.json({
      success: true,
      middleware: "hono",
      payment: payment ? {
        payerAddress: payment.payerAddress,
        version: payment.version,
      } : null,
    });
  });

  const server = Bun.serve({
    fetch: app.fetch,
    port: 30099,
    hostname: "127.0.0.1",
  });

  // Test without payment header
  console.log("Testing without payment header (should get 402):");
  const response1 = await fetch("http://127.0.0.1:30099/api/test");
  const body1 = await response1.json();
  console.log("Status:", response1.status);
  console.log("Headers:", Object.fromEntries(response1.headers));
  console.log("Body:", body1);

  console.log("\nTesting with Faremeter format (should fail on parsing):");
  const response2 = await fetch("http://127.0.0.1:30099/api/test", {
    headers: {
      "X-PAYMENT": "base64-encoded",
    },
  });
  const body2 = await response2.json();
  console.log("Status:", response2.status);
  console.log("Headers:", Object.fromEntries(response2.headers));
  console.log("Body:", body2);

  server.stop();
}

main().catch(console.error);
