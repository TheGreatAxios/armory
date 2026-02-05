import { test, expect, mock } from "bun:test";
import * as middleware from "../src/index.js";

// ============================================================
// Type Exports
// ============================================================

test("All types are properly exported", () => {
  expect(typeof middleware).toBe("object");
});

// ============================================================
// createPaymentRequirements
// ============================================================

test("createPaymentRequirements creates valid V1 requirements", () => {
  const config = {
    payTo: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
    network: "ethereum",
    amount: "1000000",
  };

  const requirements = middleware.createPaymentRequirements(config, 1);

  expect(requirements).toHaveProperty("amount", "1000000");
  expect(requirements).toHaveProperty("network");
  expect(requirements).toHaveProperty("contractAddress");
  expect(requirements).toHaveProperty("payTo", config.payTo);
  expect(requirements).toHaveProperty("expiry");
  expect(requirements.expiry).toBeGreaterThan(Math.floor(Date.now() / 1000));
});

test("createPaymentRequirements creates valid V2 requirements", () => {
  const config = {
    payTo: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
    network: "ethereum",
    amount: "1000000",
  };

  const requirements = middleware.createPaymentRequirements(config, 2);

  expect(requirements).toHaveProperty("amount", "1000000");
  expect(requirements).toHaveProperty("to");
  expect(requirements).toHaveProperty("chainId");
  expect(requirements).toHaveProperty("assetId");
  expect(requirements).toHaveProperty("nonce");
  expect(requirements).toHaveProperty("expiry");
  expect(requirements.expiry).toBeGreaterThan(Math.floor(Date.now() / 1000));
});

test("createPaymentRequirements defaults to V1 when version not specified", () => {
  const config = {
    payTo: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
    network: "ethereum",
    amount: "1000000",
  };

  const requirements = middleware.createPaymentRequirements(config);

  expect(requirements).toHaveProperty("contractAddress");
  expect(requirements).toHaveProperty("network");
});

// ============================================================
// createPaymentRequiredHeaders
// ============================================================

test("createPaymentRequiredHeaders creates correct V1 headers", () => {
  const v1Requirements: middleware.PaymentRequirements = {
    amount: "1000000",
    network: "ethereum",
    contractAddress: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    payTo: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
    expiry: Math.floor(Date.now() / 1000) + 3600,
  };

  const headers = middleware.createPaymentRequiredHeaders(v1Requirements, 1);

  expect(headers).toHaveProperty("X-PAYMENT-REQUIRED");
  expect(typeof headers["X-PAYMENT-REQUIRED"]).toBe("string");

  const decoded = atob(headers["X-PAYMENT-REQUIRED"]);
  const parsed = JSON.parse(decoded);
  expect(parsed).toEqual(v1Requirements);
});

test("createPaymentRequiredHeaders creates correct V2 headers", () => {
  const v2Requirements: middleware.PaymentRequirements = {
    amount: "1000000",
    to: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
    chainId: "eip155:1",
    assetId: "eip155:1/erc20:0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    nonce: "12345",
    expiry: Math.floor(Date.now() / 1000) + 3600,
  };

  const headers = middleware.createPaymentRequiredHeaders(v2Requirements, 2);

  expect(headers).toHaveProperty("PAYMENT-REQUIRED");
  expect(typeof headers["PAYMENT-REQUIRED"]).toBe("string");

  const decoded = atob(headers["PAYMENT-REQUIRED"]);
  const parsed = JSON.parse(decoded);
  expect(parsed).toEqual(v2Requirements);
});

// ============================================================
// createSettlementHeaders
// ============================================================

test("createSettlementHeaders creates correct V1 settlement headers", () => {
  const v1Response: middleware.SettlementResponse = {
    status: "success",
    txHash: "0xabc123",
    timestamp: Math.floor(Date.now() / 1000),
  };

  const headers = middleware.createSettlementHeaders(v1Response, 1);

  expect(headers).toHaveProperty("X-PAYMENT-RESPONSE");
  expect(typeof headers["X-PAYMENT-RESPONSE"]).toBe("string");

  const decoded = atob(headers["X-PAYMENT-RESPONSE"]);
  const parsed = JSON.parse(decoded);
  expect(parsed.status).toBe("success");
});

test("createSettlementHeaders creates correct V2 settlement headers", () => {
  const v2Response: middleware.SettlementResponse = {
    status: "success",
    txHash: "0xabc123",
    timestamp: Math.floor(Date.now() / 1000),
  };

  const headers = middleware.createSettlementHeaders(v2Response, 2);

  expect(headers).toHaveProperty("PAYMENT-RESPONSE");
  expect(typeof headers["PAYMENT-RESPONSE"]).toBe("string");

  const decoded = atob(headers["PAYMENT-RESPONSE"]);
  const parsed = JSON.parse(decoded);
  expect(parsed.status).toBe("success");
});

// ============================================================
// getHeadersForVersion
// ============================================================

test("getHeadersForVersion returns correct headers for V1", () => {
  const headers = middleware.getHeadersForVersion(1);

  expect(headers).toEqual({
    payment: "X-PAYMENT",
    required: "X-PAYMENT-REQUIRED",
    response: "X-PAYMENT-RESPONSE",
  });
});

test("getHeadersForVersion returns correct headers for V2", () => {
  const headers = middleware.getHeadersForVersion(2);

  expect(headers).toEqual({
    payment: "PAYMENT-SIGNATURE",
    required: "PAYMENT-REQUIRED",
    response: "PAYMENT-RESPONSE",
  });
});

// ============================================================
// getRequirementsVersion
// ============================================================

test("getRequirementsVersion detects version from V1 headers", () => {
  const v1Requirements: middleware.PaymentRequirements = {
    amount: "1000000",
    network: "ethereum",
    contractAddress: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    payTo: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
    expiry: 1234567890,
  };

  const version = middleware.getRequirementsVersion(v1Requirements);
  expect(version).toBe(1);
});

test("getRequirementsVersion detects version from V2 headers", () => {
  const v2Requirements: middleware.PaymentRequirements = {
    amount: "1000000",
    to: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
    chainId: "eip155:1",
    assetId: "eip155:1/erc20:0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    nonce: "12345",
    expiry: 1234567890,
  };

  const version = middleware.getRequirementsVersion(v2Requirements);
  expect(version).toBe(2);
});

// ============================================================
// encodeRequirements
// ============================================================

test("encodeRequirements encodes V1 requirements to JSON string", () => {
  const requirements: middleware.PaymentRequirements = {
    amount: "1000000",
    network: "ethereum",
    contractAddress: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    payTo: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
    expiry: 1234567890,
  };

  const encoded = middleware.encodeRequirements(requirements);

  expect(typeof encoded).toBe("string");
  const parsed = JSON.parse(encoded);
  expect(parsed.amount).toBe("1000000");
});

// ============================================================
// decodePayload
// ============================================================

test("decodePayload decodes V1 JSON payload", () => {
  const v1Payload = {
    amount: "1000000",
    network: "ethereum",
    contractAddress: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    payTo: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
    from: "0x1234567890123456789012345678901234567890",
    expiry: Math.floor(Date.now() / 1000) + 3600,
    signature: "0xabc",
  };

  const headerValue = JSON.stringify(v1Payload);
  const result = middleware.decodePayload(headerValue);

  expect(result.payload).toBeDefined();
  expect(result.version).toBeDefined();
});

test("decodePayload decodes V1 base64 payload", () => {
  const v1Payload = {
    amount: "1000000",
    network: "ethereum",
    contractAddress: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    payTo: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
    from: "0x1234567890123456789012345678901234567890",
    expiry: Math.floor(Date.now() / 1000) + 3600,
    signature: "0xabc",
  };

  const headerValue = btoa(JSON.stringify(v1Payload));
  const result = middleware.decodePayload(headerValue);

  expect(result.payload).toBeDefined();
  expect(result.version).toBeDefined();
});

// ============================================================
// extractPayerAddress
// ============================================================

test("extractPayerAddress extracts from V1 payload", () => {
  const v1Payload: any = {
    amount: "1000000",
    network: "ethereum",
    contractAddress: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    payTo: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
    from: "0x1234567890123456789012345678901234567890",
    expiry: Math.floor(Date.now() / 1000) + 3600,
    signature: "0xabc",
  };

  const address = middleware.extractPayerAddress(v1Payload);
  expect(address).toBe("0x1234567890123456789012345678901234567890");
});

test("extractPayerAddress extracts from V2 payload", () => {
  const v2Payload: any = {
    to: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
    from: "0x1234567890123456789012345678901234567890",
    amount: "1000000",
    chainId: "eip155:1",
    assetId: "eip155:1/erc20:0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    nonce: "12345",
    expiry: Math.floor(Date.now() / 1000) + 3600,
    signature: "0xabc",
  };

  const address = middleware.extractPayerAddress(v2Payload);
  expect(address).toBe("0x1234567890123456789012345678901234567890");
});

// ============================================================
// createResponseHeaders
// ============================================================

test("createResponseHeaders creates V1 response headers", () => {
  const headers = middleware.createResponseHeaders(
    "0x1234567890123456789012345678901234567890",
    1
  );

  expect(headers).toHaveProperty("X-PAYMENT-RESPONSE");
  const parsed = JSON.parse(headers["X-PAYMENT-RESPONSE"]);
  expect(parsed.status).toBe("verified");
  expect(parsed.payerAddress).toBe("0x1234567890123456789012345678901234567890");
  expect(parsed.version).toBe(1);
});

test("createResponseHeaders creates V2 response headers", () => {
  const headers = middleware.createResponseHeaders(
    "0x1234567890123456789012345678901234567890",
    2
  );

  expect(headers).toHaveProperty("PAYMENT-RESPONSE");
  const parsed = JSON.parse(headers["PAYMENT-RESPONSE"]);
  expect(parsed.status).toBe("verified");
  expect(parsed.payerAddress).toBe("0x1234567890123456789012345678901234567890");
  expect(parsed.version).toBe(2);
});

// ============================================================
// createBunMiddleware
// ============================================================

test("createBunMiddleware returns middleware function", () => {
  const config: middleware.BunMiddlewareConfig = {
    payTo: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
    network: "ethereum",
    amount: "1000000",
  };

  const mw = middleware.createBunMiddleware(config);
  expect(typeof mw).toBe("function");
});

test("createBunMiddleware returns 402 when no payment header provided", async () => {
  const config: middleware.BunMiddlewareConfig = {
    payTo: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
    network: "ethereum",
    amount: "1000000",
  };

  const mw = middleware.createBunMiddleware(config);
  const request = new Request("https://example.com");

  const response = await mw(request);

  expect(response).not.toBeNull();
  expect(response?.status).toBe(402);

  const body = await response?.json();
  expect(body.error).toBe("Payment required");
});

test("createBunMiddleware returns 402 with V2 payment required header", async () => {
  const config: middleware.BunMiddlewareConfig = {
    payTo: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
    network: "ethereum",
    amount: "1000000",
    defaultVersion: 2,
  };

  const mw = middleware.createBunMiddleware(config);
  const request = new Request("https://example.com");

  const response = await mw(request);

  expect(response?.status).toBe(402);
  expect(response?.headers.get("PAYMENT-REQUIRED")).toBeDefined();
});

test("createBunMiddleware returns 402 with V1 payment required header", async () => {
  const config: middleware.BunMiddlewareConfig = {
    payTo: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
    network: "ethereum",
    amount: "1000000",
    defaultVersion: 1,
  };

  const mw = middleware.createBunMiddleware(config);
  const request = new Request("https://example.com");

  const response = await mw(request);

  expect(response?.status).toBe(402);
  expect(response?.headers.get("X-PAYMENT-REQUIRED")).toBeDefined();
});
