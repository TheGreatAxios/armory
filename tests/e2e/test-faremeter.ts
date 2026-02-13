/**
 * Faremeter SDK E2E Test
 * 
 * Tests that Armory middleware can handle requests from Faremeter SDK
 * 
 * Usage:
 *   bun run test:e2e:faremeter
 * 
 * Environment:
 *   TEST_PRIVATE_KEY - Private key with Base Sepolia USDC
 *   SERVER_URL - Server URL (default: http://localhost:8787)
 */

import { wrap } from "@faremeter/fetch";
import { createPaymentHandler } from "@faremeter/payment-evm/exact";
import { privateKeyToAccount } from "viem/accounts";

const SERVER_URL = process.env.SERVER_URL || "http://localhost:8787";
const TARGET_URL = `${SERVER_URL}/api/test`;

async function testFaremeterPayment() {
  const { TEST_PRIVATE_KEY } = process.env;

  if (!TEST_PRIVATE_KEY) {
    console.error("❌ TEST_PRIVATE_KEY environment variable is required");
    console.log("   Get testnet USDC at: https://faucet.quicknode.com/base/sepolia");
    process.exit(1);
  }

  console.log("🧪 Faremeter SDK E2E Test");
  console.log("=".repeat(50));

  console.log("\n🔐 Creating account from private key...");
  const account = privateKeyToAccount(TEST_PRIVATE_KEY as `0x${string}`);
  console.log(`   Address: ${account.address}`);

  console.log("\n📦 Initializing Faremeter client...");
  
  const wallet = {
    ...account,
    chain: { id: 84532 }, // Base Sepolia
  };

  const fetchWithPayment = wrap(fetch, {
    handlers: [createPaymentHandler(wallet)],
  });

  console.log(`\n🌐 Making request to: ${TARGET_URL}`);

  try {
    // First request - should get 402 Payment Required
    console.log("\n📨 Step 1: Request without payment (expect 402)...");
    const response = await fetchWithPayment(TARGET_URL, {
      method: "GET",
    });

    console.log(`   Status: ${response.status}`);
    
    // Check for payment required headers
    const paymentRequired = response.headers.get("PAYMENT-REQUIRED");
    const xPaymentRequired = response.headers.get("X-PAYMENT-REQUIRED");
    
    console.log(`   PAYMENT-REQUIRED header: ${paymentRequired ? "Present" : "Missing"}`);
    console.log(`   X-PAYMENT-REQUIRED header: ${xPaymentRequired ? "Present" : "Missing"}`);

    if (response.status === 402) {
      console.log("   ✅ Got 402 Payment Required (expected)");
      
      // Parse the payment required response
      const acceptHeader = paymentRequired || xPaymentRequired;
      if (acceptHeader) {
        try {
          const decoded = JSON.parse(Buffer.from(acceptHeader, "base64").toString());
          console.log(`   ✅ Parsed payment required:`);
          console.log(`      x402Version: ${decoded.x402Version}`);
          console.log(`      accepts: ${decoded.accepts?.length || 0} scheme(s)`);
          
          if (decoded.accepts?.[0]) {
            const req = decoded.accepts[0];
            console.log(`      scheme: ${req.scheme}`);
            console.log(`      network: ${req.network}`);
            console.log(`      maxAmount: ${req.maxAmountRequired || req.amount}`);
          }
        } catch (e) {
          console.log(`   ⚠️  Could not parse payment required: ${e}`);
        }
      }
    } else if (response.status === 200) {
      console.log("   ✅ Got 200 OK (payment already verified or not required)");
    } else {
      console.log(`   ⚠️  Unexpected status: ${response.status}`);
    }

    // Get response body
    const body = await response.text();
    console.log(`\n📦 Response body:`);
    console.log(body.substring(0, 500));

    console.log("\n✅ Test completed!");
    
  } catch (error) {
    console.error("\n❌ Test failed:", error);
    if (error instanceof Error) {
      if (error.message.includes("No scheme registered")) {
        console.error("   → Network not supported");
      } else if (error.message.includes("insufficient funds")) {
        console.error("   → Insufficient funds");
      } else if (error.message.includes("402")) {
        console.error("   → Payment required error");
      }
    }
    process.exit(1);
  }
}

testFaremeterPayment();
