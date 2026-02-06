import type { Signer } from "ethers";
import {
  decodeSettlement,
  type SettlementResponse,
} from "@armory-sh/base";
import type { X402TransportConfig, X402RequestInit } from "./types";
import { createPaymentPayload, parsePaymentRequirements } from "./protocol";
import { SignerRequiredError } from "./types";

const defaultConfig: Required<X402TransportConfig> = {
  baseURL: "",
  headers: {},
  timeout: 30000,
  autoPay: true,
  maxRetries: 3,
  retryDelay: 1000,
  onPaymentRequired: () => true,
  onPaymentSuccess: () => {},
  onPaymentError: () => {},
};

type TransportState = {
  config: Required<X402TransportConfig>;
  signer?: Signer;
};

const createState = (config?: X402TransportConfig): TransportState => ({
  config: { ...defaultConfig, ...config },
});

const fetchWithTimeout = async (
  url: string,
  init: RequestInit,
  timeout: number
): Promise<Response> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`Request timeout after ${timeout}ms`);
    }
    throw error;
  }
};

const delay = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

const handlePaymentRequired = async (
  state: TransportState,
  response: Response
): Promise<{ success: boolean; settlement?: SettlementResponse; error?: Error }> => {
  if (!state.signer) {
    throw new SignerRequiredError("Cannot handle payment: no signer configured.");
  }

  try {
    const requirements = await parsePaymentRequirements(response);
    const from = await state.signer.getAddress();
    const [payload, headerName] = await createPaymentPayload(requirements, state.signer, from);

    const paymentResponse = await fetchWithTimeout(
      response.url,
      {
        method: "GET",
        headers: { ...state.config.headers, [headerName]: payload },
      },
      state.config.timeout
    );

    return { success: true, settlement: decodeSettlement(paymentResponse.headers) };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error : new Error(String(error)) };
  }
};

const shouldRetryPayment = async (
  state: TransportState,
  response: Response
): Promise<boolean> => {
  if (!state.config.autoPay) return false;
  const requirements = await parsePaymentRequirements(response);
  return await state.config.onPaymentRequired(requirements);
};

const x402Fetch = async (
  state: TransportState,
  url: string,
  init: X402RequestInit = {}
): Promise<Response> => {
  const fullUrl = state.config.baseURL ? new URL(url, state.config.baseURL).toString() : url;
  const headers = new Headers({ ...state.config.headers, ...init.headers });

  for (let attempt = 1; attempt <= state.config.maxRetries; attempt++) {
    try {
      const response = await fetchWithTimeout(fullUrl, { ...init, headers }, state.config.timeout);

      if (response.status === 402 && !init.skipAutoPay && await shouldRetryPayment(state, response)) {
        const paymentResult = await handlePaymentRequired(state, response);
        if (paymentResult.success) {
          state.config.onPaymentSuccess(paymentResult.settlement);
          continue;
        }
        state.config.onPaymentError(paymentResult.error ?? new Error("Payment failed"));
      }

      return response;
    } catch (error) {
      const lastError = error instanceof Error ? error : new Error(String(error));
      if (attempt === state.config.maxRetries) throw lastError;
      await delay(state.config.retryDelay * attempt);
    }
  }

  throw new Error("Max retries exceeded");
};

const createMethod = (
  state: TransportState,
  method: string
) => async (url: string, bodyOrInit?: unknown | X402RequestInit, init?: X402RequestInit): Promise<Response> => {
  const bodyInit = typeof bodyOrInit === "object" && bodyOrInit !== null && "headers" in bodyOrInit
    ? bodyOrInit as X402RequestInit
    : undefined;
  const body = typeof bodyOrInit === "object" && bodyOrInit !== null && !("headers" in bodyOrInit)
    ? bodyOrInit
    : undefined;
  const finalInit = bodyInit ?? init;

  return x402Fetch(state, url, {
    ...finalInit,
    method,
    headers: { ...finalInit?.headers, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
};

export interface X402Transport {
  fetch(url: string, init?: X402RequestInit): Promise<Response>;
  get(url: string, init?: X402RequestInit): Promise<Response>;
  post(url: string, body?: unknown, init?: X402RequestInit): Promise<Response>;
  put(url: string, body?: unknown, init?: X402RequestInit): Promise<Response>;
  del(url: string, init?: X402RequestInit): Promise<Response>;
  patch(url: string, body?: unknown, init?: X402RequestInit): Promise<Response>;
  setSigner(signer: Signer): void;
  getSigner(): Signer | undefined;
}

export const createX402Transport = (config?: X402TransportConfig): X402Transport => {
  let state = createState(config);

  return {
    fetch: (url, init) => x402Fetch(state, url, init),
    get: createMethod(state, "GET"),
    post: createMethod(state, "POST"),
    put: createMethod(state, "PUT"),
    del: createMethod(state, "DELETE"),
    patch: createMethod(state, "PATCH"),
    setSigner: (signer: Signer) => { state.signer = signer; },
    getSigner: () => state.signer,
  };
};
