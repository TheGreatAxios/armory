export type TypedDataDomain = {
    name?: string;
    version?: string;
    chainId?: number;
    verifyingContract?: `0x${string}`;
    salt?: `0x${string}`;
};
export interface EIP712Domain {
    name: string;
    version: string;
    chainId: number;
    verifyingContract: `0x${string}`;
}
export interface TransferWithAuthorization {
    from: `0x${string}`;
    to: `0x${string}`;
    value: bigint;
    validAfter: bigint;
    validBefore: bigint;
    nonce: bigint;
}
export type TypedDataField = {
    name: string;
    type: string;
};
export type EIP712Types = {
    TransferWithAuthorization: TypedDataField[];
};
export declare const EIP712_TYPES: {
    readonly TransferWithAuthorization: [{
        readonly name: "from";
        readonly type: "address";
    }, {
        readonly name: "to";
        readonly type: "address";
    }, {
        readonly name: "value";
        readonly type: "uint256";
    }, {
        readonly name: "validAfter";
        readonly type: "uint256";
    }, {
        readonly name: "validBefore";
        readonly type: "uint256";
    }, {
        readonly name: "nonce";
        readonly type: "uint256";
    }];
};
export declare const USDC_DOMAIN: {
    readonly NAME: "USD Coin";
    readonly VERSION: "2";
};
export declare const createEIP712Domain: (chainId: number, contractAddress: `0x${string}`) => EIP712Domain;
export declare const createTransferWithAuthorization: (params: Omit<TransferWithAuthorization, "value" | "validAfter" | "validBefore" | "nonce"> & {
    value: bigint | number;
    validAfter: bigint | number;
    validBefore: bigint | number;
    nonce: bigint | number;
}) => TransferWithAuthorization;
export declare const validateTransferWithAuthorization: (message: TransferWithAuthorization) => boolean;
//# sourceMappingURL=eip712.d.ts.map