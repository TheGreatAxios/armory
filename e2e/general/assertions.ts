/**
 * Custom E2E Test Assertions
 *
 * Reusable assertion helpers for end-to-end testing.
 */

import { expect } from "bun:test";

// ============================================================================
// Payment Assertions
// ============================================================================

export interface PaymentResponse {
  status: number;
  headers: Record<string, string>;
  body?: unknown;
}

export interface SettlementResponse {
  success: boolean;
  transaction?: string;
  network?: string;
  payer?: string;
}

/**
 * Assert that a payment required response (402) is correct
 */
export function assertPaymentRequired(
  response: PaymentResponse,
  version: 1 | 2
): void {
  expect(response.status).toBe(402);

  const paymentHeader = version === 1 ? "X-PAYMENT-REQUIRED" : "PAYMENT-REQUIRED";
  expect(response.headers[paymentHeader]).toBeDefined();

  const requirements = JSON.parse(response.headers[paymentHeader]!);
  expect(requirements).toHaveProperty("x402Version", version);
  expect(requirements).toHaveProperty("accepts");
  expect(Array.isArray(requirements.accepts)).toBe(true);
}

/**
 * Assert that a payment verification response is correct
 */
export function assertPaymentVerified(
  response: PaymentResponse,
  version: 1 | 2
): void {
  expect(response.status).toBeGreaterThanOrEqual(200);
  expect(response.status).toBeLessThan(300);

  const responseHeader = version === 1 ? "X-PAYMENT-RESPONSE" : "PAYMENT-RESPONSE";
  expect(response.headers[responseHeader]).toBeDefined();

  const responseBody = JSON.parse(response.headers[responseHeader]!);
  expect(responseBody).toHaveProperty("status", "verified");
  expect(responseBody).toHaveProperty("payerAddress");
  expect(responseBody.payerAddress).toMatch(/^0x[a-fA-F0-9]{40}$/);
}

/**
 * Assert that an error response is correct
 */
export function assertPaymentError(
  response: PaymentResponse,
  expectedErrorMessage: string
): void {
  expect(response.status).toBeGreaterThanOrEqual(400);
  expect(response.status).toBeLessThan(500);

  if (response.body) {
    const body = typeof response.body === "string"
      ? JSON.parse(response.body)
      : response.body;
    expect(body).toHaveProperty("error");
    expect(body.error).toContain(expectedErrorMessage);
  }
}

/**
 * Assert settlement response format
 */
export function assertSettlementResponse(
  response: SettlementResponse
): void {
  expect(response).toHaveProperty("success");
  if (response.success) {
    expect(response).toHaveProperty("transaction");
    expect(response.transaction).toMatch(/^0x[a-fA-F0-9]{64}$/);
    expect(response).toHaveProperty("network");
    expect(response).toHaveProperty("payer");
    expect(response.payer).toMatch(/^0x[a-fA-F0-9]{40}$/);
  }
}

/**
 * Assert payment payload structure
 */
export function assertPaymentPayload(
  payload: unknown,
  version: 1 | 2
): void {
  expect(payload).toBeDefined();
  expect(typeof payload).toBe("object");

  const p = payload as Record<string, unknown>;
  expect(p).toHaveProperty("x402Version", version);
  expect(p).toHaveProperty("scheme", "exact");
  expect(p).toHaveProperty("network");
  expect(p).toHaveProperty("payload");

  const innerPayload = p.payload as Record<string, unknown>;
  expect(innerPayload).toHaveProperty("signature");
  expect(innerPayload.signature).toMatch(/^0x[a-fA-F0-9]{130}$/);

  expect(innerPayload).toHaveProperty("authorization");
  const auth = innerPayload.authorization as Record<string, unknown>;
  expect(auth).toHaveProperty("from");
  expect(auth.from).toMatch(/^0x[a-fA-F0-9]{40}$/);
  expect(auth).toHaveProperty("to");
  expect(auth.to).toMatch(/^0x[a-fA-F0-9]{40}$/);
  expect(auth).toHaveProperty("value");
  expect(auth).toHaveProperty("validAfter");
  expect(auth).toHaveProperty("validBefore");
  expect(auth).toHaveProperty("nonce");
  expect(auth.nonce).toMatch(/^0x[a-fA-F0-9]{64}$/);
}

/**
 * Assert payment requirements structure
 */
export function assertPaymentRequirements(
  requirements: unknown,
  version: 1 | 2
): void {
  expect(requirements).toBeDefined();
  expect(typeof requirements).toBe("object");

  const r = requirements as Record<string, unknown>;
  expect(r).toHaveProperty("scheme", "exact");
  expect(r).toHaveProperty("network");

  if (version === 1) {
    expect(r).toHaveProperty("maxAmountRequired");
    expect(r).toHaveProperty("asset");
    expect(r).toHaveProperty("resource");
    expect(r).toHaveProperty("description");
  } else {
    expect(r).toHaveProperty("amount");
    expect(r).toHaveProperty("asset");
  }

  expect(r).toHaveProperty("payTo");
  expect(r.payTo).toMatch(/^0x[a-fA-F0-9]{40}$/);
}

/**
 * Assert headers are present and correctly formatted
 */
export function assertHeaders(
  headers: Record<string, string>,
  expectedHeaders: Record<string, string>
): void {
  for (const [key, value] of Object.entries(expectedHeaders)) {
    expect(headers[key]).toBeDefined();
    expect(headers[key]).toBe(value);
  }
}

/**
 * Assert version detection
 */
export function assertVersionDetection(
  payload: unknown,
  expectedVersion: 1 | 2
): void {
  const p = payload as Record<string, unknown>;
  expect(p).toHaveProperty("x402Version", expectedVersion);
}

/**
 * Helper to parse payment header
 */
export function parsePaymentHeader(
  headerValue: string
): unknown {
  // Try JSON first
  if (headerValue.startsWith("{")) {
    return JSON.parse(headerValue);
  }
  // Try base64
  try {
    return JSON.parse(atob(headerValue));
  } catch {
    throw new Error("Could not parse payment header");
  }
}
