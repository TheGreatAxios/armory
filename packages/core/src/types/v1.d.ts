export interface PaymentPayloadV1 {
    from: string;
    to: string;
    amount: string;
    nonce: string;
    expiry: number;
    v: number;
    r: string;
    s: string;
    chainId: number;
    contractAddress: string;
    network: string;
}
export interface PaymentRequirementsV1 {
    amount: string;
    network: string;
    contractAddress: string;
    payTo: string;
    expiry: number;
}
export interface SettlementResponseV1 {
    success: boolean;
    txHash?: string;
    error?: string;
    timestamp: number;
}
export declare const V1_HEADERS: {
    readonly PAYMENT: "X-PAYMENT";
    readonly PAYMENT_RESPONSE: "X-PAYMENT-RESPONSE";
};
export declare function encodePaymentPayload(payload: PaymentPayloadV1): string;
export declare function decodePaymentPayload(encoded: string): PaymentPayloadV1;
export declare function encodeSettlementResponse(response: SettlementResponseV1): string;
export declare function decodeSettlementResponse(encoded: string): SettlementResponseV1;
//# sourceMappingURL=v1.d.ts.map