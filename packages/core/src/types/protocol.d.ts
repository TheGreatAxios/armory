import type { PaymentPayloadV1, PaymentRequirementsV1, SettlementResponseV1 } from "./v1";
import type { PaymentPayloadV2, PaymentRequirementsV2, SettlementResponseV2 } from "./v2";
export type PaymentPayload = PaymentPayloadV1 | PaymentPayloadV2;
export type PaymentRequirements = PaymentRequirementsV1 | PaymentRequirementsV2;
export type SettlementResponse = SettlementResponseV1 | SettlementResponseV2;
export declare const isV1: (payload: PaymentPayload) => payload is PaymentPayloadV1;
export declare const isV2: (payload: PaymentPayload) => payload is PaymentPayloadV2;
export declare const getPaymentVersion: (payload: PaymentPayload) => 1 | 2;
export declare const getRequirementsVersion: (requirements: PaymentRequirements) => 1 | 2;
export declare const getSettlementVersion: (response: SettlementResponse) => 1 | 2;
export declare const getPaymentHeaderName: (version: 1 | 2) => string;
export declare const getPaymentResponseHeaderName: (version: 1 | 2) => string;
export declare const getPaymentRequiredHeaderName: (version: 1 | 2) => string;
export declare const isSettlementSuccessful: (response: SettlementResponse) => boolean;
export declare const getTxHash: (response: SettlementResponse) => string | undefined;
//# sourceMappingURL=protocol.d.ts.map