import type {
  PaymentPayloadV2,
  SettlementResponseV2,
} from "./types/v2";
import { V2_HEADERS } from "./types/v2";

export { V2_HEADERS };

export type PaymentPayload = PaymentPayloadV2;
export type SettlementResponse = SettlementResponseV2;

/**
 * JSON encode/decode for V2 (plain JSON, no Base64)
 */
const jsonEncode = (data: unknown): string => JSON.stringify(data);

const jsonDecode = <T>(encoded: string): T => JSON.parse(encoded) as T;

export const encodePaymentV2 = (payload: PaymentPayloadV2): string => jsonEncode(payload);
export const decodePaymentV2 = (encoded: string): PaymentPayloadV2 => jsonDecode(encoded);

export const encodeSettlementV2 = (response: SettlementResponseV2): string => jsonEncode(response);
export const decodeSettlementV2 = (encoded: string): SettlementResponseV2 => jsonDecode(encoded);

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
  "signature" in payload && typeof payload.signature === "object";

/**
 * Type guard for V2 settlement
 */
export const isSettlementV2 = (response: SettlementResponse): response is SettlementResponseV2 =>
  "status" in response;
