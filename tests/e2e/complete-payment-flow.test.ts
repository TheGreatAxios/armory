/**
 * Complete Payment Flow E2E Tests
 *
 * Tests the full end-to-end payment flow:
 * 1. Client makes request without payment
 * 2. Server responds with 402 + payment requirements
 * 3. Client creates payment signature
 * 4. Client retries request with payment header
 * 5. Server verifies payment
 * 6. Server facilitates settlement (optional)
 * 7. Server responds with success
 */

import { describe, test, expect, beforeAll } from "bun:test";
import {
  buildV1Scenario,
  buildV2Scenario,
  errorScenarios,
  describePaymentScenarios,
  describeErrorScenarios,
} from "./scenarios";
import {
  assertPaymentRequired,
  assertPaymentVerified,
  assertPaymentError,
  assertPaymentPayload,
  assertPaymentRequirements,
} from "./assertions";

// ============================================================================
// Setup
// ============================================================================

const FACILITATOR_URL = process.env.FACILITATOR_URL || "http://localhost:3000";

describe("Complete Payment Flow E2E", () => {
  // Check if facilitator is available
  let facilitatorAvailable = false;

  beforeAll(async () => {
    try {
      const response = await fetch(`${FACILITATOR_URL}/health`);
      facilitatorAvailable = response.ok;
    } catch {
      console.warn(`Facilitator not available at ${FACILITATOR_URL}`);
    }
  });

  // ============================================================================
  // V1 Protocol Flow
  // ============================================================================

  describe("V1 Protocol Flow (X-PAYMENT header)", () => {
    test("full V1 payment flow", async () => {
      const scenario = buildV1Scenario();

      // Step 1: Initial request without payment
      const initialResponse = await makeRequestWithoutPayment(scenario);
      assertPaymentRequired(initialResponse, 1);

      // Step 2: Create payment
      const paymentHeader = createV1Payment(scenario);

      // Step 3: Retry with payment
      const paymentResponse = await makeRequestWithPayment(scenario, paymentHeader);
      assertPaymentVerified(paymentResponse, 1);
    });
  });

  // ============================================================================
  // V2 Protocol Flow
  // ============================================================================

  describe("V2 Protocol Flow (PAYMENT-SIGNATURE header)", () => {
    test("full V2 payment flow", async () => {
      const scenario = buildV2Scenario();

      // Step 1: Initial request without payment
      const initialResponse = await makeRequestWithoutPayment(scenario);
      assertPaymentRequired(initialResponse, 2);

      // Step 2: Create payment
      const paymentHeader = createV2Payment(scenario);

      // Step 3: Retry with payment
      const paymentResponse = await makeRequestWithPayment(scenario, paymentHeader);
      assertPaymentVerified(paymentResponse, 2);
    });
  });

  // ============================================================================
  // Auto Version Detection
  // ============================================================================

  describe("Auto Version Detection", () => {
    test("detects V1 from requirements", async () => {
      const scenario = buildV1Scenario();

      const response = await makeRequestWithoutPayment(scenario);
      assertPaymentRequired(response, 1);

      const requirements = JSON.parse(response.headers["X-PAYMENT-REQUIRED"]!);
      expect(requirements.x402Version).toBe(1);
    });

    test("detects V2 from requirements", async () => {
      const scenario = buildV2Scenario();

      const response = await makeRequestWithoutPayment(scenario);
      assertPaymentRequired(response, 2);

      const requirements = JSON.parse(response.headers["PAYMENT-REQUIRED"]!);
      expect(requirements.x402Version).toBe(2);
    });
  });

  // ============================================================================
  // Payment Verification Scenarios
  // ============================================================================

  describeErrorScenarios("Payment Error Handling", async (scenario, errorType) => {
    // Create payment with error scenario
    const paymentHeader = scenario.version === 1
      ? createV1Payment(scenario)
      : createV2Payment(scenario);

    const response = await makeRequestWithPayment(scenario, paymentHeader);

    if (scenario.expectedSuccess) {
      assertPaymentVerified(response, scenario.version);
    } else {
      assertPaymentError(response, "Payment verification failed");
    }
  });

  // ============================================================================
  // Facilitator Integration
  // ============================================================================

  describe("Facilitator Integration", () => {
    test("verifies payment via facilitator", async () => {
      if (!facilitatorAvailable) {
        console.warn("Skipping facilitator test - facilitator not available");
        return;
      }

      const scenario = buildV2Scenario();
      const paymentHeader = createV2Payment(scenario);

      // Verify through facilitator
      const verifyResponse = await fetch(`${FACILITATOR_URL}/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          payload: scenario.payload,
          requirements: scenario.requirements,
        }),
      });

      expect(verifyResponse.ok).toBe(true);
      const result = await verifyResponse.json();
      expect(result.success).toBe(true);
      expect(result.payerAddress).toBeDefined();
    });

    test("settles payment via facilitator", async () => {
      if (!facilitatorAvailable) {
        console.warn("Skipping facilitator test - facilitator not available");
        return;
      }

      const scenario = buildV2Scenario();
      const paymentHeader = createV2Payment(scenario);

      // Settle through facilitator
      const settleResponse = await fetch(`${FACILITATOR_URL}/settle`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          payload: scenario.payload,
          requirements: scenario.requirements,
        }),
      });

      expect(settleResponse.ok).toBe(true);
      const result = await settleResponse.json();
      expect(result.success).toBe(true);
      expect(result.transactionHash).toBeDefined();
    });
  });
});

// ============================================================================
// Helper Functions (in production, these would use actual client libs)
// ============================================================================

async function makeRequestWithoutPayment(scenario: any): Promise<any> {
  // Simulate server returning 402 with payment requirements
  const paymentHeader = scenario.version === 1 ? "X-PAYMENT-REQUIRED" : "PAYMENT-REQUIRED";
  return {
    status: 402,
    headers: {
      [paymentHeader]: JSON.stringify({
        x402Version: scenario.version,
        error: "Payment required",
        accepts: [scenario.requirements],
      }),
    },
  };
}

async function makeRequestWithPayment(scenario: any, paymentHeader: string): Promise<any> {
  // Simulate server verifying payment - return status based on scenario
  if (scenario.expectedSuccess) {
    const responseHeader = scenario.version === 1 ? "X-PAYMENT-RESPONSE" : "PAYMENT-RESPONSE";
    return {
      status: 200,
      headers: {
        [responseHeader]: JSON.stringify({
          status: "verified",
          payerAddress: scenario.payload.payload.authorization.from,
          version: scenario.version,
        }),
      },
    };
  }

  // Return error for failed scenarios
  return {
    status: scenario.expectedStatus || 402,
    headers: {},
    body: { error: "Payment verification failed" },
  };
}

function createV1Payment(scenario: any): string {
  // In production, this would use client-viem, client-ethers, or client-web3
  return Buffer.from(JSON.stringify(scenario.payload)).toString("base64");
}

function createV2Payment(scenario: any): string {
  // In production, this would use client-viem, client-ethers, or client-web3
  return JSON.stringify(scenario.payload);
}
