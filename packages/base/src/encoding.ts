import type {
  PaymentPayloadV2,
  SettlementResponseV2,
} from "./types/v2";
import { V2_HEADERS } from "./types/v2";

export { V2_HEADERS };

export type PaymentPayload = PaymentPayloadV2;
export type SettlementResponse = SettlementResponseV2;

/**
 * Safe Base64 decode (handles URL-safe format)
 */
function safeBase64Decode(str: string): string {
  const padding = 4 - (str.length % 4);
  if (padding !== 4) {
    str += "=".repeat(padding);
  }
  str = str.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(str, "base64").toString("utf-8");
}

/**
 * Safe Base64 encode (URL-safe, no padding)
 */
function safeBase64Encode(str: string): string {
  return Buffer.from(str)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

/**
 * JSON encode/decode for V2 (Base64URL-encoded JSON for x402 compatibility)
 */
const jsonEncode = (data: unknown): string => JSON.stringify(data);

const base64JsonEncode = (data: unknown): string => safeBase64Encode(JSON.stringify(data));

const base64JsonDecode = <T>(encoded: string): T => JSON.parse(safeBase64Decode(encoded)) as T;

export const encodePaymentV2 = (payload: PaymentPayloadV2): string => base64JsonEncode(payload);
export const decodePaymentV2 = (encoded: string): PaymentPayloadV2 => base64JsonDecode(encoded);

export const encodeSettlementV2 = (response: SettlementResponseV2): string => base64JsonEncode(response);
export const decodeSettlementV2 = (encoded: string): SettlementResponseV2 => base64JsonDecode(encoded);

/**
 * Always returns 2 for V2-only mode
 */
export const detectPaymentVersion = (headers: Headers): 2 | null => {
  if (headers.has(V2_HEADERS.PAYMENT_SIGNATURE)) return 2;
  return null;
};

/**
 * Decode payment from headers (V2 only)
 */
export const decodePayment = (headers: Headers): PaymentPayload => {
  const encoded = headers.get(V2_HEADERS.PAYMENT_SIGNATURE);
  if (!encoded) {
    throw new Error(`No ${V2_HEADERS.PAYMENT_SIGNATURE} header found`);
  }
  return decodePaymentV2(encoded);
};

/**
 * Decode settlement from headers (V2 only)
 */
export const decodeSettlement = (headers: Headers): SettlementResponse => {
  const v2Response = headers.get(V2_HEADERS.PAYMENT_RESPONSE);
  if (v2Response) return decodeSettlementV2(v2Response);

  throw new Error(`No ${V2_HEADERS.PAYMENT_RESPONSE} header found`);
};

/**
 * Type guard for V2 payload
 */
export const isPaymentV2 = (payload: PaymentPayload): payload is PaymentPayloadV2 =>
  "x402Version" in payload &&
  (payload as PaymentPayloadV2).x402Version === 2 &&
  "accepted" in payload &&
  "payload" in payload;

/**
 * Type guard for V2 settlement
 */
export const isSettlementV2 = (response: SettlementResponse): response is SettlementResponseV2 =>
  "success" in response &&
  typeof (response as SettlementResponseV2).success === "boolean" &&
  "network" in response;
