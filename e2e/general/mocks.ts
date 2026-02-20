/**
 * E2E Test Mock Utilities
 *
 * Provides utilities for testing middleware directly without HTTP servers.
 * Mocks facilitator calls and provides mock request/response objects.
 */

import type { PaymentRequirements, X402PaymentPayload } from "@armory-sh/base";

export interface MockFacilitatorConfig {
  verifyResult?: {
    isValid: boolean;
    payer?: string;
    invalidReason?: string;
  };
  settleResult?: {
    success: boolean;
    transaction?: string;
    errorReason?: string;
  };
  validateV2Format?: boolean;
}

export interface MockFetchHandle {
  restore: () => void;
  verifyCalls: number;
  settleCalls: number;
  lastVerifyBody?: { paymentPayload: unknown; paymentRequirements: unknown };
  lastSettleBody?: { paymentPayload: unknown; paymentRequirements: unknown };
}

const defaultVerifyResult = {
  isValid: true,
  payer: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1",
};

const defaultSettleResult = {
  success: true,
  transaction: "0xabcdef1234567890",
};

function validateV2PayloadFormat(
  paymentPayload: unknown,
  _paymentRequirements: unknown,
): { isValid: boolean; invalidReason?: string } {
  if (!paymentPayload || typeof paymentPayload !== "object") {
    return {
      isValid: false,
      invalidReason: "invalid_payload_missing_accepted_field",
    };
  }

  const payload = paymentPayload as Record<string, unknown>;

  if (!("accepted" in payload)) {
    return {
      isValid: false,
      invalidReason: "invalid_payload_missing_accepted_field",
    };
  }

  if (!("payload" in payload)) {
    return {
      isValid: false,
      invalidReason: "invalid_payload_missing_payload_field",
    };
  }

  if ("scheme" in payload && "network" in payload && !("accepted" in payload)) {
    return {
      isValid: false,
      invalidReason: "invalid_payload_legacy_format_not_accepted_field",
    };
  }

  return { isValid: true };
}

export function mockFacilitator(
  config: MockFacilitatorConfig = {},
): MockFetchHandle {
  const originalFetch = globalThis.fetch;
  const state = {
    verifyCalls: 0,
    settleCalls: 0,
    lastVerifyBody: undefined as
      | { paymentPayload: unknown; paymentRequirements: unknown }
      | undefined,
    lastSettleBody: undefined as
      | { paymentPayload: unknown; paymentRequirements: unknown }
      | undefined,
  };

  const verifyResult = config.verifyResult ?? defaultVerifyResult;
  const settleResult = config.settleResult ?? defaultSettleResult;
  const validateV2 = config.validateV2Format ?? false;

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);

    if (url.endsWith("/verify")) {
      state.verifyCalls++;

      let body:
        | { paymentPayload: unknown; paymentRequirements: unknown }
        | undefined;
      try {
        body = JSON.parse(init?.body as string);
        state.lastVerifyBody = body;
      } catch {
        // ignore parse errors
      }

      if (validateV2 && body) {
        const formatCheck = validateV2PayloadFormat(
          body.paymentPayload,
          body.paymentRequirements,
        );
        if (!formatCheck.isValid) {
          return new Response(
            JSON.stringify({
              isValid: false,
              invalidReason: formatCheck.invalidReason,
            }),
            {
              status: 200,
              headers: { "Content-Type": "application/json" },
            },
          );
        }
      }

      return new Response(JSON.stringify(verifyResult), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (url.endsWith("/settle")) {
      state.settleCalls++;

      try {
        state.lastSettleBody = JSON.parse(init?.body as string);
      } catch {
        // ignore parse errors
      }

      return new Response(JSON.stringify(settleResult), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    return originalFetch(input, init);
  }) as typeof fetch;

  return {
    restore: () => {
      globalThis.fetch = originalFetch;
    },
    get verifyCalls() {
      return state.verifyCalls;
    },
    get settleCalls() {
      return state.settleCalls;
    },
    get lastVerifyBody() {
      return state.lastVerifyBody;
    },
    get lastSettleBody() {
      return state.lastSettleBody;
    },
  };
}

export interface MockExpressRequest {
  headers: Record<string, string>;
  method: string;
  url: string;
  payment?: {
    payload: X402PaymentPayload;
    payerAddress: string;
    verified: boolean;
  };
}

export interface MockExpressResponse {
  statusCode: number;
  headers: Record<string, string>;
  body: unknown;
  status: (code: number) => MockExpressResponse;
  json: (data: unknown) => MockExpressResponse;
  setHeader: (key: string, value: string) => void;
  getHeader: (key: string) => string | undefined;
  end: (data?: unknown) => void;
}

export function createMockExpressRequest(
  headers: Record<string, string> = {},
): MockExpressRequest {
  return {
    headers,
    method: "GET",
    url: "/api/test",
  };
}

export function createMockExpressResponse(): MockExpressResponse {
  const state = {
    statusCode: 200,
    headers: {} as Record<string, string>,
    body: null as unknown,
    ended: false,
  };

  return {
    get statusCode() {
      return state.statusCode;
    },
    set statusCode(value: number) {
      state.statusCode = value;
    },
    get headers() {
      return state.headers;
    },
    get body() {
      return state.body;
    },
    status(code: number) {
      state.statusCode = code;
      return this;
    },
    json(data: unknown) {
      state.body = data;
      return this;
    },
    setHeader(key: string, value: string) {
      state.headers[key] = value;
    },
    getHeader(key: string) {
      return state.headers[key];
    },
    end(data?: unknown) {
      if (data !== undefined) {
        state.body = data;
      }
      state.ended = true;
    },
  };
}

export interface MockHonoContext {
  req: {
    header: (name: string) => string | undefined;
    path: string;
    method: string;
  };
  res: Response;
  status: (code: number) => void;
  header: (key: string, value: string) => void;
  json: (data: unknown) => Response;
  set: (key: string, value: unknown) => void;
  get: (key: string) => unknown;
  _state: {
    statusCode: number;
    headers: Record<string, string>;
    body: unknown;
    store: Record<string, unknown>;
  };
}

export function createMockHonoContext(
  headers: Record<string, string> = {},
): MockHonoContext {
  const normalizedHeaders: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    normalizedHeaders[key.toLowerCase()] = value;
  }

  const state = {
    statusCode: 200,
    headers: {} as Record<string, string>,
    body: null as unknown,
    store: {} as Record<string, unknown>,
  };

  return {
    req: {
      header: (name: string) => normalizedHeaders[name.toLowerCase()],
      path: "/api/test",
      method: "GET",
    },
    get res() {
      return new Response(JSON.stringify(state.body), {
        status: state.statusCode,
        headers: state.headers,
      });
    },
    status(code: number) {
      state.statusCode = code;
    },
    header(key: string, value: string) {
      state.headers[key] = value;
    },
    json(data: unknown): Response {
      state.body = data;
      return new Response(JSON.stringify(data), {
        status: state.statusCode,
        headers: { "Content-Type": "application/json", ...state.headers },
      });
    },
    set(key: string, value: unknown) {
      state.store[key] = value;
    },
    get(key: string) {
      return state.store[key];
    },
    _state: state,
  };
}

export const TEST_REQUIREMENTS: PaymentRequirements = {
  scheme: "exact",
  network: "eip155:84532",
  amount: "1000000",
  asset: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
  payTo: "0x1234567890123456789012345678901234567890",
  maxTimeoutSeconds: 300,
};

export const MOCK_FACILITATOR_URL = "http://facilitator.test";
