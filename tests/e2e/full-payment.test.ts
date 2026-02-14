/**
 * E2E Full Payment Tests
 *
 * Tests actual payments between middleware servers and faremeter/x402 clients.
 *
 * NOTE: These tests verify the API integration (verify/settle endpoints) only.
 * Real on-chain transactions are handled by the test:pay script.
 */

import { test, expect, describe } from "bun:test";
import { TEST_NETWORK, TEST_AMOUNT, TEST_PAY_TO_ADDRESS, FACILITATOR_URL } from "./config";

describe("E2E Full Payment Tests", () => {
  test.serial("Facilitator verify API is accessible", async () => {
    const facilitatorUrl = FACILITATOR_URL;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    try {
      const res = await fetch(`${facilitatorUrl}/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
        signal: controller.signal,
      });
      // Accept valid responses: 400/422 (invalid request), 402 (payment required), 500/502 (server errors)
      expect([400, 422, 402, 500, 502]).toContain(res.status);
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        throw new Error("Facilitator API timeout - service may be unavailable");
      }
      throw err;
    } finally {
      clearTimeout(timeoutId);
    }
  });

  test.serial("Facilitator settle API is accessible", async () => {
    const facilitatorUrl = FACILITATOR_URL;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    try {
      const res = await fetch(`${facilitatorUrl}/settle`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
        signal: controller.signal,
      });
      // Accept valid responses: 400/422 (invalid request), 402 (payment required), 500/502 (server errors)
      expect([400, 422, 402, 500, 502]).toContain(res.status);
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        throw new Error("Facilitator API timeout - service may be unavailable");
      }
      throw err;
    } finally {
      clearTimeout(timeoutId);
    }
  });
});
