/**
 * Hono Middleware - Payment Utils Tests
 *
 * Tests for:
 * - decodePayload
 * - encodeRequirements (via getRequirementsVersion)
 * - getHeadersForVersion
 * - extractPayerAddress
 * - createResponseHeaders
 */

import { test, expect, describe, beforeAll, afterAll } from "bun:test";
import {
  decodePayload,
  getHeadersForVersion,
  getRequirementsVersion,
  verifyWithFacilitator,
  extractPayerAddress,
  createResponseHeaders,
} from "../src/payment-utils";
import { createX402V1Payload, createX402V2Payload, createFaremeterPayload } from "../../core/src/fixtures/payloads";
import { createX402V1Requirements, createX402V2Requirements } from "../../core/src/fixtures/requirements";

// ============================================================================
// getHeadersForVersion Tests
// ============================================================================

describe("[middleware-hono]: getHeadersForVersion", () => {
describe("[middleware-hono]: getRequirementsVersion", () => {
describe("[middleware-hono]: decodePayload", () => {
describe("[middleware-hono]: extractPayerAddress", () => {
describe("[middleware-hono]: createResponseHeaders", () => {
  test("creates V1 response headers", () => {
    const headers = createResponseHeaders("0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1" as any, 1);
    expect(headers["X-PAYMENT-RESPONSE"]).toBeDefined();
    const parsed = JSON.parse(headers["X-PAYMENT-RESPONSE"]!);
    expect(parsed.status).toBe("verified");
    expect(parsed.payerAddress).toBe("0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1");
    expect(parsed.version).toBe(1);
  });

  test("creates V2 response headers", () => {
    const headers = createResponseHeaders("0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1" as any, 2);
    expect(headers["PAYMENT-RESPONSE"]).toBeDefined();
    const parsed = JSON.parse(headers["PAYMENT-RESPONSE"]!);
    expect(parsed.status).toBe("verified");
    expect(parsed.payerAddress).toBe("0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1");
    expect(parsed.version).toBe(2);
  });
});
