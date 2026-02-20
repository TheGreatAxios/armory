import type { X402PaymentPayload } from "@armory-sh/base";
import { decodePayloadHeader } from "@armory-sh/base";

export { extractPayerAddress } from "@armory-sh/base";

export function decodePayload(headerValue: string): {
  payload: X402PaymentPayload;
} {
  return { payload: decodePayloadHeader(headerValue) };
}
