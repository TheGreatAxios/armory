export type TransferWithAuthorizationParams = readonly [
    from: `0x${string}`,
    to: `0x${string}`,
    amount: bigint,
    validAfter: bigint,
    expiry: bigint,
    v: number,
    r: `0x${string}`,
    s: `0x${string}`
];
export type ReceiveWithAuthorizationParams = readonly [
    from: `0x${string}`,
    to: `0x${string}`,
    amount: bigint,
    validAfter: bigint,
    expiry: bigint,
    v: number,
    r: `0x${string}`,
    s: `0x${string}`
];
export type BalanceOfParams = readonly [account: `0x${string}`];
export type BalanceOfReturnType = bigint;
export type NameReturnType = string;
export type SymbolReturnType = string;
export declare const ERC20_ABI: readonly [{
    readonly type: "function";
    readonly name: "transferWithAuthorization";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly name: "from";
        readonly type: "address";
    }, {
        readonly name: "to";
        readonly type: "address";
    }, {
        readonly name: "amount";
        readonly type: "uint256";
    }, {
        readonly name: "validAfter";
        readonly type: "uint256";
    }, {
        readonly name: "expiry";
        readonly type: "uint256";
    }, {
        readonly name: "v";
        readonly type: "uint8";
    }, {
        readonly name: "r";
        readonly type: "bytes32";
    }, {
        readonly name: "s";
        readonly type: "bytes32";
    }];
    readonly outputs: readonly [];
}, {
    readonly type: "function";
    readonly name: "receiveWithAuthorization";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly name: "from";
        readonly type: "address";
    }, {
        readonly name: "to";
        readonly type: "address";
    }, {
        readonly name: "amount";
        readonly type: "uint256";
    }, {
        readonly name: "validAfter";
        readonly type: "uint256";
    }, {
        readonly name: "expiry";
        readonly type: "uint256";
    }, {
        readonly name: "v";
        readonly type: "uint8";
    }, {
        readonly name: "r";
        readonly type: "bytes32";
    }, {
        readonly name: "s";
        readonly type: "bytes32";
    }];
    readonly outputs: readonly [];
}, {
    readonly type: "function";
    readonly name: "balanceOf";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly name: "account";
        readonly type: "address";
    }];
    readonly outputs: readonly [{
        readonly name: "balance";
        readonly type: "uint256";
    }];
}, {
    readonly type: "function";
    readonly name: "name";
    readonly stateMutability: "view";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly name: "";
        readonly type: "string";
    }];
}, {
    readonly type: "function";
    readonly name: "symbol";
    readonly stateMutability: "view";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly name: "";
        readonly type: "string";
    }];
}];
export type ERC20Abi = typeof ERC20_ABI;
//# sourceMappingURL=erc20.d.ts.map