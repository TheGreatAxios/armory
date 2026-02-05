import type {
  PaymentPayloadV1,
  SettlementResponseV1,
} from "./types/v1";
import { V1_HEADERS } from "./types/v1";
import type {
  PaymentPayloadV2,
  SettlementResponseV2,
} from "./types/v2";
import { V2_HEADERS } from "./types/v2";

export { V1_HEADERS, V2_HEADERS };

export type PaymentPayload = PaymentPayloadV1 | PaymentPayloadV2;
export type SettlementResponse = SettlementResponseV1 | SettlementResponseV2;

const base64Encode = (data: unknown): string =>
  Buffer.from(JSON.stringify(data)).toString("base64");

const base64Decode = <T>(encoded: string): T =>
  JSON.parse(Buffer.from(encoded, "base64").toString("utf-8")) as T;

const jsonEncode = (data: unknown): string => JSON.stringify(data);

const jsonDecode = <T>(encoded: string): T => JSON.parse(encoded) as T;

export const encodePaymentV1 = (payload: PaymentPayloadV1): string => base64Encode(payload);
export const decodePaymentV1 = (encoded: string): PaymentPayloadV1 => base64Decode(encoded);

export const encodeSettlementV1 = (response: SettlementResponseV1): string => base64Encode(response);
export const decodeSettlementV1 = (encoded: string): SettlementResponseV1 => base64Decode(encoded);

export const encodePaymentV2 = (payload: PaymentPayloadV2): string => jsonEncode(payload);
export const decodePaymentV2 = (encoded: string): PaymentPayloadV2 => jsonDecode(encoded);

export const encodeSettlementV2 = (response: SettlementResponseV2): string => jsonEncode(response);
export const decodeSettlementV2 = (encoded: string): SettlementResponseV2 => jsonDecode(encoded);

export const detectPaymentVersion = (headers: Headers): 1 | 2 | null => {
  if (headers.has(V1_HEADERS.PAYMENT)) return 1;
  if (headers.has(V2_HEADERS.PAYMENT_SIGNATURE)) return 2;
  return null;
};

export const decodePayment = (headers: Headers): PaymentPayload => {
  const version = detectPaymentVersion(headers);
  if (version === null) {
    throw new Error("No valid payment headers found. Expected X-PAYMENT (v1) or PAYMENT-SIGNATURE (v2)");
  }
  const headerName = version === 1 ? V1_HEADERS.PAYMENT : V2_HEADERS.PAYMENT_SIGNATURE;
  const encoded = headers.get(headerName);
  if (!encoded) throw new Error(`Header ${headerName} is empty`);
  return version === 1 ? decodePaymentV1(encoded) : decodePaymentV2(encoded);
};

export const decodeSettlement = (headers: Headers): SettlementResponse => {
  const v1Response = headers.get(V1_HEADERS.PAYMENT_RESPONSE);
  if (v1Response) return decodeSettlementV1(v1Response);

  const v2Response = headers.get(V2_HEADERS.PAYMENT_RESPONSE);
  if (v2Response) return decodeSettlementV2(v2Response);

  throw new Error("No valid settlement response headers found. Expected X-PAYMENT-RESPONSE (v1) or PAYMENT-RESPONSE (v2)");
};

export const isPaymentV1 = (payload: PaymentPayload): payload is PaymentPayloadV1 =>
  "v" in payload && typeof payload.v === "number";

export const isPaymentV2 = (payload: PaymentPayload): payload is PaymentPayloadV2 =>
  "signature" in payload && typeof payload.signature === "object";

export const isSettlementV1 = (response: SettlementResponse): response is SettlementResponseV1 =>
  "success" in response;

export const isSettlementV2 = (response: SettlementResponse): response is SettlementResponseV2 =>
  "status" in response;
