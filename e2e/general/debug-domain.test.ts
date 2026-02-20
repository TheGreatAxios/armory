/**
 * Debug EIP-712 Domain - Compare what domain each approach uses
 */

import { describe, expect, test } from "bun:test";
import {
  armoryGet,
  createX402Client,
} from "@armory-sh/client-viem";
import { privateKeyToAccount } from "viem/accounts";

describe("[debug|domain]: Compare EIP-712 Domain", () => {
  const TEST_PRIVATE_KEY = `0x${"a".repeat(64)}`;
  const account = privateKeyToAccount(TEST_PRIVATE_KEY as `0x${string}`);

  test("logs the EIP-712 domain used by each approach", async () => {
    let armoryGetDomain: unknown = null;
    let clientDomain: unknown = null;
    let phase = "armoryGet";

    // Monkey patch signTypedData to capture the domain
    const originalSignTypedData = account.signTypedData.bind(account);
    account.signTypedData = async (params) => {
      if (phase === "armoryGet") {
        armoryGetDomain = params.domain;
        console.log("\n=== armoryGet EIP-712 Domain ===");
        console.log(JSON.stringify(params.domain, null, 2));
      } else {
        clientDomain = params.domain;
        console.log("\n=== createX402Client EIP-712 Domain ===");
        console.log(JSON.stringify(params.domain, null, 2));
      }
      return originalSignTypedData(params);
    };

    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const headers = new Headers(init?.headers);

      // Track which phase we're in
      if (armoryGetDomain && !clientDomain) {
        phase = "client";
      }

      // Return 402 first
      if ((url === "https://api.example.com/data" || url === "https://api.example.com/data/") && !headers.has("PAYMENT-SIGNATURE")) {
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

      // Mock facilitator
      if (url.endsWith("/verify")) {
        return new Response(
          JSON.stringify({ isValid: true, payer: account.address }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }

      if (url.endsWith("/settle")) {
        return new Response(
          JSON.stringify({ success: true, transaction: "0xabc123", network: "eip155:84532" }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }

      return new Response("Not found", { status: 404 });
    };

    console.log("\n==================== Testing armoryGet ====================");
    const armoryGetResult = await armoryGet(
      { account },
      "https://api.example.com/data",
      "base-sepolia",
      "usdc",
    );
    console.log("armoryGet result:", armoryGetResult.success ? "SUCCESS" : "FAILED");

    console.log("\n==================== Testing createX402Client ====================");
    const client = createX402Client({
      wallet: { type: "account", account },
    });
    const response = await client.fetch("https://api.example.com/data");
    console.log("createX402Client result:", response.ok ? "SUCCESS" : "FAILED");

    console.log("\n==================== Domain Comparison ====================");
    console.log("armoryGet domain:", JSON.stringify(armoryGetDomain, null, 2));
    console.log("client domain:", JSON.stringify(clientDomain, null, 2));

    expect(armoryGetDomain).toBeDefined();
    expect(clientDomain).toBeDefined();

    // Check if they're the same
    if (JSON.stringify(armoryGetDomain) === JSON.stringify(clientDomain)) {
      console.log("\n✅ DOMAINS ARE THE SAME");
    } else {
      console.log("\n❌ DOMAINS ARE DIFFERENT - THIS IS THE BUG!");
    }
  });
});
