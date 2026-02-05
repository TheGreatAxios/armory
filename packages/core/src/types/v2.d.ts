export type CAIP2ChainId = `eip155:${string}`;
export type CAIPAssetId = `eip155:${string}/erc20:${string}`;
export type Address = `0x${string}`;
export interface Signature {
    v: number;
    r: string;
    s: string;
}
export type PayToV2 = Address | {
    role?: string;
    callback?: string;
};
export interface Extensions {
    [key: string]: unknown;
}
export interface PaymentPayloadV2 {
    from: Address;
    to: PayToV2;
    amount: string;
    nonce: string;
    expiry: number;
    signature: Signature;
    chainId: CAIP2ChainId;
    assetId: CAIPAssetId;
    extensions?: Extensions;
}
export interface PaymentRequirementsV2 {
    amount: string;
    to: PayToV2;
    chainId: CAIP2ChainId;
    assetId: CAIPAssetId;
    nonce: string;
    expiry: number;
    extensions?: Extensions;
}
export interface SettlementResponseV2 {
    status: "success" | "pending" | "failed";
    txHash?: string;
    txId?: string;
    timestamp: number;
    extensions?: Extensions;
}
export declare const V2_HEADERS: {
    readonly PAYMENT_SIGNATURE: "PAYMENT-SIGNATURE";
    readonly PAYMENT_REQUIRED: "PAYMENT-REQUIRED";
    readonly PAYMENT_RESPONSE: "PAYMENT-RESPONSE";
};
export declare function isCAIP2ChainId(value: string): value is CAIP2ChainId;
export declare function isCAIPAssetId(value: string): value is CAIPAssetId;
export declare function isAddress(value: string): value is Address;
//# sourceMappingURL=v2.d.ts.map