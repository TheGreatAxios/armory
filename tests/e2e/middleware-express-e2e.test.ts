/**
 * Middleware-Express E2E Tests
 *
 * End-to-end tests for @armory-sh/middleware-express
 */

import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import express, { type Request, type Response } from "express";
import { paymentMiddleware, type PaymentMiddlewareConfig } from "@armory-sh/middleware-express";
import { TOKENS } from "@armory-sh/tokens";
import { registerToken } from "@armory-sh/base";
import {
  assertPaymentRequired,
  assertPaymentVerified,
  assertPaymentError,
} from "./assertions";
import { buildV1Scenario, buildV2Scenario } from "./scenarios";

// ============================================================================
// Setup
// ============================================================================

const FACILITATOR_URL = process.env.FACILITATOR_URL || "http://localhost:3000";
const BASE_PORT = 13000;

describe("Middleware-Express E2E", () => {
  let server: any;
  let app: any;
  let facilitatorAvailable = false;

  beforeAll(async () => {
    registerToken(TOKENS.USDC_BASE);
    registerToken(TOKENS.USDC_BASE_SEPOLIA);

    try {
      const response = await fetch(`${FACILITATOR_URL}/health`);
      facilitatorAvailable = response.ok;
    } catch {
      console.warn("Facilitator not available");
    }

    // Create and start server once
    app = express();
    app.use(express.json());

    // Protected endpoint (middleware added per test)
    app.get("/protected/data", (req: any, res: Response) => {
      res.json({ success: true, data: "protected data" });
    });

    await new Promise<void>((resolve, reject) => {
      server = app.listen(BASE_PORT, () => {
        ACTUAL_PORT = BASE_PORT;
        resolve();
      }).on("error", (err: any) => reject(err));
    });
  });

  afterAll((done) => {
    if (server && server.listening) {
      server.close(() => done());
    } else {
      done();
    }
  });

  // Helper to set middleware for a test
  function setMiddleware(config: PaymentMiddlewareConfig) {
    // Reset express stack
    app._router.stack = [];
    app.use(express.json());
    app.use(paymentMiddleware(config));
  }

  // Helper to make request to protected endpoint
  async function makeRequest(headers: Record<string, string>) {
    const response = await fetch(`http://localhost:${ACTUAL_PORT}/protected/data`, {
      headers,
    });

    const responseHeaders: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      responseHeaders[key] = value;
    });

    return { response, headers: responseHeaders };
  }

  // ============================================================================
  // V1 Protocol Flow
  // ============================================================================

  describe("V1 Protocol Flow (X-PAYMENT header)", () => {
    test("returns 402 with payment requirements", async () => {
      setMiddleware({
        requirements: {
          scheme: "exact",
          network: "base-sepolia",
          maxAmountRequired: "1000000",
          asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as `0x${string}`,
          payTo: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as `0x${string}`,
          resource: "http://localhost:3001/protected/data",
          description: "Test resource",
          maxTimeoutSeconds: 300,
        },
        skipVerification: true,
      });

      const { response, headers } = await makeRequest({});

      assertPaymentRequired({
        status: response.status,
        headers,
      }, 1);
    });

    test("accepts V1 payment header", async () => {
      setMiddleware({
        requirements: {
          scheme: "exact",
          network: "base-sepolia",
          maxAmountRequired: "1000000",
          asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as `0x${string}`,
          payTo: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as `0x${string}`,
          resource: "http://localhost:3001/protected/data",
          description: "Test resource",
          maxTimeoutSeconds: 300,
        },
        facilitatorUrl: facilitatorAvailable ? FACILITATOR_URL : undefined,
        skipVerification: !facilitatorAvailable,
      });

      const scenario = buildV1Scenario();
      const paymentHeader = Buffer.from(JSON.stringify(scenario.payload)).toString("base64");

      const { response, headers } = await makeRequest({
        "X-PAYMENT": paymentHeader,
      });

      assertPaymentVerified({
        status: response.status,
        headers,
      }, 1);
    });
  });

  // ============================================================================
  // V2 Protocol Flow
  // ============================================================================

  describe("V2 Protocol Flow (PAYMENT-SIGNATURE header)", () => {
    test("returns 402 with payment requirements", async () => {
      setMiddleware({
        requirements: [{
          scheme: "exact",
          network: "eip155:84532",
          amount: "1000000",
          asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as `0x${string}`,
          payTo: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as `0x${string}`,
          maxTimeoutSeconds: 300,
        }],
        skipVerification: true,
      });

      const { response, headers } = await makeRequest({});

      assertPaymentRequired({
        status: response.status,
        headers,
      }, 2);
    });

    test("accepts V2 payment header", async () => {
      setMiddleware({
        requirements: [{
          scheme: "exact",
          network: "eip155:84532",
          amount: "1000000",
          asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as `0x${string}`,
          payTo: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as `0x${string}`,
          maxTimeoutSeconds: 300,
        }],
        facilitatorUrl: facilitatorAvailable ? FACILITATOR_URL : undefined,
        skipVerification: !facilitatorAvailable,
      });

      const scenario = buildV2Scenario();
      const paymentHeader = JSON.stringify(scenario.payload);

      const { response, headers } = await makeRequest({
        "PAYMENT-SIGNATURE": paymentHeader,
      });

      assertPaymentVerified({
        status: response.status,
        headers,
      }, 2);
    });
  });

  // ============================================================================
  // Error Handling
  // ============================================================================

  describe("Error Handling", () => {
    test("returns 400 for invalid payment payload", async () => {
      setMiddleware({
        requirements: {
          scheme: "exact",
          network: "base-sepolia",
          maxAmountRequired: "1000000",
          asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as `0x${string}`,
          payTo: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as `0x${string}`,
          resource: "http://localhost:3001/protected/data",
          description: "Test resource",
          maxTimeoutSeconds: 300,
        },
        skipVerification: true,
      });

      const { response, headers } = await makeRequest({
        "X-PAYMENT": "invalid-base64-payload",
      });

      assertPaymentError({
        status: response.status,
        headers,
      });
    });

    test("returns 402 for version mismatch", async () => {
      setMiddleware({
        requirements: {
          scheme: "exact",
          network: "base-sepolia",
          maxAmountRequired: "1000000",
          asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as `0x${string}`,
          payTo: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as `0x${string}`,
          resource: "http://localhost:3001/protected/data",
          description: "Test resource",
          maxTimeoutSeconds: 300,
        },
        skipVerification: true,
      });

      const scenario = buildV2Scenario();
      const paymentHeader = JSON.stringify(scenario.payload);

      const { response, headers } = await makeRequest({
        "PAYMENT-SIGNATURE": paymentHeader,
      });

      assertPaymentError({
        status: response.status,
        headers,
      });
    });
  });

  // ============================================================================
  // Augmented Request
  // ============================================================================

  describe("Augmented Request", () => {
    test("adds payment property to request", async () => {
      let capturedReq: any = null;

      // Reset middleware with custom handler to capture request
      app._router.stack = [];
      app.use(express.json());
      app.use(paymentMiddleware({
        requirements: {
          scheme: "exact",
          network: "base-sepolia",
          maxAmountRequired: "1000000",
          asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as `0x${string}`,
          payTo: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as `0x${string}`,
          resource: "http://localhost:3001/protected/data",
          description: "Test resource",
          maxTimeoutSeconds: 300,
        },
        skipVerification: true,
      }));

      app.get("/capture", (req: any, res: Response) => {
        capturedReq = req;
        res.json({ success: true });
      });

      const scenario = buildV1Scenario();
      const paymentHeader = Buffer.from(JSON.stringify(scenario.payload)).toString("base64");

      await fetch(`http://localhost:${TEST_PORT}/capture`, {
        headers: {
          "X-PAYMENT": paymentHeader,
        },
      });

      expect(capturedReq).not.toBeNull();
      expect(capturedReq.payment).toBeDefined();
      expect(capturedReq.payment.x402Version).toBe(1);
    });
  });
});
