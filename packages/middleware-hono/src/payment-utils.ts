import type { X402PaymentPayload } from "@armory-sh/base";
import { decodePayloadHeader, PAYMENT_RESPONSE_HEADER } from "@armory-sh/base";

export { extractPayerAddress } from "@armory-sh/base";

export function decodePayload(headerValue: string): { payload: X402PaymentPayload } {
  return { payload: decodePayloadHeader(headerValue) };
}

export function createResponseHeaders(payerAddress: string): Record<string, string> {
  return {
    [PAYMENT_RESPONSE_HEADER]: JSON.stringify({ status: "verified", payerAddress }),
  };
}
