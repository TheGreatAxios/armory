import type { Web3X402Client, X402Transport, X402TransportOptions } from "./types";
import {
  V1_HEADERS,
  V2_HEADERS,
  encodePaymentV1,
  encodePaymentV2,
  isX402V1Requirements,
  isX402V2Requirements,
  type PaymentRequirementsV1,
  type PaymentRequirementsV2,
  type PaymentPayloadV1,
  type PaymentPayloadV2,
} from "@armory-sh/base";
import {
  detectX402Version,
  parsePaymentRequired,
  isPaymentRequiredResponse,
  selectSchemeRequirements,
  type X402Version,
} from "./protocol";

const DEFAULT_MAX_RETRIES = 3;

/**
 * Create payment headers based on detected version and payload
 */
const createPaymentHeaders = (
  payload: PaymentPayloadV1 | PaymentPayloadV2,
  version: X402Version
): Headers => {
  const headers = new Headers();

  if (version === 1) {
    headers.set(V1_HEADERS.PAYMENT, encodePaymentV1(payload as PaymentPayloadV1));
  } else {
    headers.set(V2_HEADERS.PAYMENT_SIGNATURE, encodePaymentV2(payload as PaymentPayloadV2));
  }

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
  const baseDelay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
  const jitter = Math.random() * 100;
  return new Promise((resolve) => setTimeout(resolve, baseDelay + jitter));
};

/**
 * Handle 402 Payment Required response
 * Detects protocol version and creates appropriate payment headers
 */
const handlePaymentRequired = async (
  response: Response,
  client: Web3X402Client
): Promise<Headers> => {
  // Detect protocol version from response
  const version = detectX402Version(response, client.getVersion());

  // Parse payment requirements using protocol functions
  const parsed = await parsePaymentRequired(response, version);

  // Select the first "exact" scheme requirements
  const selectedRequirements = selectSchemeRequirements(parsed.requirements, "exact");

  if (!selectedRequirements) {
    throw new Error("No supported payment scheme found in requirements");
  }

  // Convert requirements to client format based on version
  let result;

  if (version === 1 && isX402V1Requirements(selectedRequirements)) {
    // V1 requirements
    const req = selectedRequirements as PaymentRequirementsV1;
    result = await client.handlePaymentRequired(req);
  } else if (version === 2 && isX402V2Requirements(selectedRequirements)) {
    // V2 requirements
    const req = selectedRequirements as PaymentRequirementsV2;
    result = await client.handlePaymentRequired(req);
  } else {
    // Fallback - try to handle with raw requirements
    result = await client.handlePaymentRequired(selectedRequirements as PaymentRequirementsV1 | PaymentRequirementsV2);
  }

  // Create appropriate payment headers based on version
  return createPaymentHeaders(result.payload, version);
};

/**
 * Merge payment headers into existing request init
 */
const mergePaymentHeaders = (
  init: RequestInit = {},
  paymentHeaders: Headers
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
export const createX402Transport = (options: X402TransportOptions): X402Transport => {
  const client = options.client;
  const autoSign = options.autoSign ?? true;
  const maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;

  return {
    getClient: () => client,

    fetch: async (url: string | Request, init?: RequestInit): Promise<Response> => {
      let attempt = 0;
      let lastError: Error | undefined;

      while (attempt < maxRetries) {
        attempt++;

        try {
          const response = await fetch(url, init);

          // Check for 402 Payment Required using protocol detection
          if (isPaymentRequiredResponse(response) && autoSign) {
            const paymentHeaders = await handlePaymentRequired(response, client);
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
export const createFetchWithX402 = (
  transport: X402Transport
): (url: string | Request, init?: RequestInit) => Promise<Response> =>
  (url: string | Request, init?: RequestInit) => transport.fetch(url, init);
