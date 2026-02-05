export type CAIP2ChainId = `eip155:${string}`;

export type CAIPAssetId = `eip155:${string}/erc20:${string}`;

export type Address = `0x${string}`;

export interface Signature {
  v: number;
  r: string;
  s: string;
}

export type PayToV2 =
  | Address
  | {
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

export const V2_HEADERS = {
  PAYMENT_SIGNATURE: "PAYMENT-SIGNATURE",
  PAYMENT_REQUIRED: "PAYMENT-REQUIRED",
  PAYMENT_RESPONSE: "PAYMENT-RESPONSE",
} as const;

export function isCAIP2ChainId(value: string): value is CAIP2ChainId {
  return /^eip155:\d+$/.test(value);
}

export function isCAIPAssetId(value: string): value is CAIPAssetId {
  return /^eip155:\d+\/erc20:0x[a-fA-F0-9]+$/.test(value);
}

export function isAddress(value: string): value is Address {
  return /^0x[a-fA-F0-9]{40}$/.test(value);
}
