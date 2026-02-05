import type {
  PaymentPayloadV1,
  PaymentRequirementsV1,
  SettlementResponseV1,
} from "./v1";
import type {
  PaymentPayloadV2,
  PaymentRequirementsV2,
  SettlementResponseV2,
} from "./v2";

export type PaymentPayload = PaymentPayloadV1 | PaymentPayloadV2;
export type PaymentRequirements = PaymentRequirementsV1 | PaymentRequirementsV2;
export type SettlementResponse = SettlementResponseV1 | SettlementResponseV2;

export const isV1 = (payload: PaymentPayload): payload is PaymentPayloadV1 =>
  "contractAddress" in payload && "network" in payload && "v" in payload;

export const isV2 = (payload: PaymentPayload): payload is PaymentPayloadV2 =>
  "chainId" in payload && "assetId" in payload && "signature" in payload;

export const getPaymentVersion = (payload: PaymentPayload): 1 | 2 => isV1(payload) ? 1 : 2;

export const getRequirementsVersion = (requirements: PaymentRequirements): 1 | 2 =>
  "contractAddress" in requirements && "network" in requirements ? 1 : 2;

export const getSettlementVersion = (response: SettlementResponse): 1 | 2 =>
  "success" in response ? 1 : 2;

export const getPaymentHeaderName = (version: 1 | 2): string =>
  version === 1 ? "X-PAYMENT" : "PAYMENT-SIGNATURE";

export const getPaymentResponseHeaderName = (version: 1 | 2): string =>
  version === 1 ? "X-PAYMENT-RESPONSE" : "PAYMENT-RESPONSE";

export const getPaymentRequiredHeaderName = (version: 1 | 2): string =>
  version === 1 ? "X-PAYMENT-REQUIRED" : "PAYMENT-REQUIRED";

export const isSettlementSuccessful = (response: SettlementResponse): boolean =>
  "success" in response ? response.success : response.status === "success";

export const getTxHash = (response: SettlementResponse): string | undefined => response.txHash;
