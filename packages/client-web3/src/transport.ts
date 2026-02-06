import type { Web3X402Client, X402Transport, X402TransportOptions } from "./types";
import { V1_HEADERS, V2_HEADERS, encodePaymentV1, encodePaymentV2 } from "@armory-sh/base";

const DEFAULT_MAX_RETRIES = 3;

const detectProtocolVersion = (response: Response, client: Web3X402Client): 1 | 2 => {
  if (response.headers.has(V2_HEADERS.PAYMENT_REQUIRED) || response.headers.has("PAYMENT-REQUIRED")) {
    return 2;
  }
  if (response.headers.has("X-PAYMENT-REQUIRED")) {
    return 1;
  }
  return client.getVersion();
};

const parsePaymentRequirements = async (
  response: Response,
  version: 1 | 2
): Promise<unknown> => {
  if (version === 2) {
    const header = response.headers.get(V2_HEADERS.PAYMENT_REQUIRED);
    if (header) return JSON.parse(header);
  } else {
    const header = response.headers.get("X-PAYMENT-REQUIRED");
    if (header) {
      const json = Buffer.from(header, "base64").toString("utf-8");
      return JSON.parse(json);
    }
  }
  return JSON.parse(await response.clone().text());
};

const createPaymentHeaders = (payload: unknown, version: 1 | 2): Headers => {
  const headers = new Headers();
  if (version === 1) {
    headers.set(V1_HEADERS.PAYMENT, encodePaymentV1(payload as import("@armory-sh/base").PaymentPayloadV1));
  } else {
    headers.set(V2_HEADERS.PAYMENT_SIGNATURE, encodePaymentV2(payload as import("@armory-sh/base").PaymentPayloadV2));
  }
  return headers;
};

const isPaymentRelatedError = (error: Error): boolean =>
  error.message.includes("402") ||
  error.message.includes("payment") ||
  error.message.includes("signature");

const backoff = (attempt: number): Promise<void> => {
  const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
  return new Promise((resolve) => setTimeout(resolve, delay));
};

const handlePaymentRequired = async (
  response: Response,
  client: Web3X402Client
): Promise<Headers> => {
  const version = detectProtocolVersion(response, client);
  const requirements = await parsePaymentRequirements(response, version);
  const result = await client.handlePaymentRequired(
    requirements as Parameters<Web3X402Client["handlePaymentRequired"]>[0]
  );
  return createPaymentHeaders(result.payload, version);
};

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

          if (response.status === 402 && autoSign) {
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

export const createFetchWithX402 = (
  transport: X402Transport
): (url: string | Request, init?: RequestInit) => Promise<Response> =>
  (url: string | Request, init?: RequestInit) => transport.fetch(url, init);
