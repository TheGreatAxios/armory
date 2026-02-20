/**
 * Compare Payload Test - Direct comparison of what createX402Client vs armoryGet produces
 */

import { describe, expect, test } from "bun:test";
import {
  armoryGet,
  createX402Client,
} from "@armory-sh/client-viem";
import { privateKeyToAccount } from "viem/accounts";

describe("[debug|payload-compare]: Direct Payload Comparison", () => {
  const TEST_PRIVATE_KEY = `0x${"a".repeat(64)}`;
  const account = privateKeyToAccount(TEST_PRIVATE_KEY as `0x${string}`);

  test("compares payload structure from both approaches", async () => {
    // Mock fetch to capture what each sends
    let armoryGetPayload: unknown = null;
    let clientPayload: unknown = null;
    let phase = "armoryGet"; // Track which phase we're in
    let firstApiCall = true;

    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const headers = new Headers(init?.headers);

      // Track which phase we're in
      if (armoryGetPayload && !clientPayload) {
        phase = "client";
        firstApiCall = true;
      }

      // Return 402 for the API endpoint first time
      if ((url === "https://api.example.com/data" || url === "https://api.example.com/data/") && !headers.has("PAYMENT-SIGNATURE")) {
        if (firstApiCall) {
          firstApiCall = false;
        }
        return new Response("Payment Required", {
          status: 402,
          headers: {
            "PAYMENT-REQUIRED": Buffer.from(JSON.stringify({
              x402Version: 2,
              resource: { url: "https://api.example.com/data", mimeType: "application/json" },
              accepts: [{
                scheme: "exact",
                payTo: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
                amount: "1000000",
                network: "eip155:84532",
                asset: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
                maxTimeoutSeconds: 300,
              }],
            })).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, ""),
          },
        });
      }

      // Return success for the API endpoint with payment signature
      if (url === "https://api.example.com/data" || url === "https://api.example.com/data/") {
        return new Response(
          JSON.stringify({ data: "success" }),
          {
            status: 200,
            headers: {
              "PAYMENT-RESPONSE": Buffer.from(JSON.stringify({
                success: true,
                transaction: "0xabc123",
                network: "eip155:84532",
              })).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, ""),
            },
          },
        );
      }

      // Capture the /verify call
      if (url.endsWith("/verify")) {
        const body = JSON.parse(init?.body as string);
        if (phase === "armoryGet") {
          armoryGetPayload = body;
          console.log("\n=== armoryGet payload ===");
          console.log(JSON.stringify(body, null, 2));
        } else {
          clientPayload = body;
          console.log("\n=== createX402Client payload ===");
          console.log(JSON.stringify(body, null, 2));
        }
        return new Response(
          JSON.stringify({ isValid: true, payer: account.address }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }

      // Capture the /settle call
      if (url.endsWith("/settle")) {
        return new Response(
          JSON.stringify({ success: true, transaction: "0xabc123", network: "eip155:84532" }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }

      // This shouldn't happen
      console.log("Unexpected call to:", url);
      return new Response("Not found", { status: 404 });
    };

    // Test armoryGet first
    console.log("\n=== Testing armoryGet ===");
    const armoryGetResult = await armoryGet(
      { account },
      "https://api.example.com/data",
      "base-sepolia",
      "usdc",
    );

    console.log("armoryGet result:", armoryGetResult.success ? "SUCCESS" : "FAILED");

    // Test createX402Client
    console.log("\n=== Testing createX402Client without hooks ===");
    const client = createX402Client({
      wallet: { type: "account", account },
    });

    const response = await client.fetch("https://api.example.com/data");
    console.log("createX402Client result:", response.ok ? "SUCCESS" : "FAILED");

    // Compare
    expect(armoryGetPayload).toBeDefined();
    expect(clientPayload).toBeDefined();

    // Check if they have the same structure
    console.log("\n=== Comparison ===");
    console.log("armoryGet paymentPayload:", JSON.stringify(armoryGetPayload, null, 2));
    console.log("client paymentPayload:", JSON.stringify(clientPayload, null, 2));
  });
});
