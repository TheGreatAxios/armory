export interface NetworkConfig {
    name: string;
    chainId: number;
    usdcAddress: `0x${string}`;
    rpcUrl: string;
    caip2Id: string;
    caipAssetId: string;
}
export interface CustomToken {
    symbol: string;
    name: string;
    version: string;
    contractAddress: `0x${string}`;
    chainId: number;
    decimals: number;
}
export declare const NETWORKS: Record<string, NetworkConfig>;
export declare const getNetworkConfig: (name: string) => NetworkConfig | undefined;
export declare const getNetworkByChainId: (chainId: number) => NetworkConfig | undefined;
export declare const getMainnets: () => NetworkConfig[];
export declare const getTestnets: () => NetworkConfig[];
export declare const registerToken: (token: CustomToken) => CustomToken;
export declare const getCustomToken: (chainId: number, contractAddress: string) => CustomToken | undefined;
export declare const getAllCustomTokens: () => CustomToken[];
export declare const unregisterToken: (chainId: number, contractAddress: string) => boolean;
export declare const isCustomToken: (chainId: number, contractAddress: string) => boolean;
//# sourceMappingURL=networks.d.ts.map