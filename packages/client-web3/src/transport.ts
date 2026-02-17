import {
  encodePaymentV2,
  type PaymentPayloadV2,
  type PaymentRequirementsV2,
  V2_HEADERS,
} from "@armory-sh/base";
import {
  detectX402Version,
  isPaymentRequiredResponse,
  parsePaymentRequired,
  type X402Version,
} from "./protocol";
import type {
  Web3X402Client,
  X402Transport,
  X402TransportOptions,
} from "./types";

const DEFAULT_MAX_RETRIES = 3;

/**
 * Create payment headers based on detected version and payload
 */
const createPaymentHeaders = (
  payload: PaymentPayloadV2,
  _version: X402Version,
): Headers => {
  const headers = new Headers();

  headers.set(V2_HEADERS.PAYMENT_SIGNATURE, encodePaymentV2(payload));

  return headers;
};

/**
 * Check if error is payment-related and should trigger retry
 */
const isPaymentRelatedError = (error: Error): boolean =>
  error.message.includes("402") ||
  error.message.includes("payment") ||
  error.message.includes("signature") ||
  error.message.includes("Payment");

/**
 * Exponential backoff with jitter
 */
const backoff = (attempt: number): Promise<void> => {
  const baseDelay = Math.min(1000 * 2 ** (attempt - 1), 10000);
  const jitter = Math.random() * 100;
  return new Promise((resolve) => setTimeout(resolve, baseDelay + jitter));
};

/**
 * Handle 402 Payment Required response
 * Detects protocol version and creates appropriate payment headers
 */
const handlePaymentRequired = async (
  response: Response,
  client: Web3X402Client,
): Promise<Headers> => {
  const version = detectX402Version(response, client.getVersion());

  const parsed = await parsePaymentRequired(response, version);

  const selectedRequirements = parsed.requirements[0];

  if (!selectedRequirements) {
    throw new Error("No supported payment scheme found in requirements");
  }

  const req = selectedRequirements as PaymentRequirementsV2;
  const result = await client.handlePaymentRequired(req);

  return createPaymentHeaders(result.payload, version);
};

/**
 * Merge payment headers into existing request init
 */
const mergePaymentHeaders = (
  init: RequestInit = {},
  paymentHeaders: Headers,
): RequestInit => {
  const existingHeaders = new Headers(init.headers);
  for (const [key, value] of paymentHeaders.entries()) {
    existingHeaders.set(key, value);
  }
  return { ...init, headers: existingHeaders };
};

/**
 * Create an x402 transport layer for handling payment-required responses
 */
export const createX402Transport = (
  options: X402TransportOptions,
): X402Transport => {
  const client = options.client;
  const autoSign = options.autoSign ?? true;
  const maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;

  return {
    getClient: () => client,

    fetch: async (
      url: string | Request,
      init?: RequestInit,
    ): Promise<Response> => {
      let attempt = 0;
      let lastError: Error | undefined;

      while (attempt < maxRetries) {
        attempt++;

        try {
          const response = await fetch(url, init);

          if (isPaymentRequiredResponse(response) && autoSign) {
            const paymentHeaders = await handlePaymentRequired(
              response,
              client,
            );
            const newInit = mergePaymentHeaders(init, paymentHeaders);
            return await fetch(url, newInit);
          }

          return response;
        } catch (error) {
          lastError = error instanceof Error ? error : new Error(String(error));

          if (!isPaymentRelatedError(lastError)) {
            throw lastError;
          }

          if (attempt < maxRetries) {
            await backoff(attempt);
          }
        }
      }

      throw lastError ?? new Error("Max retries exceeded");
    },
  };
};

/**
 * Create a fetch function bound to an x402 transport
 */
export const createFetchWithX402 =
  (
    transport: X402Transport,
  ): ((url: string | Request, init?: RequestInit) => Promise<Response>) =>
  (url: string | Request, init?: RequestInit) =>
    transport.fetch(url, init);
