import type { Address, CAIP2ChainId, CAIPAssetId } from "@armory/base";

export interface FacilitatorConfig {
  url: string;
  createHeaders?: () => Record<string, string>;
}

export type SettlementMode = "verify" | "settle" | "async";
export type PayToAddress = Address | CAIP2ChainId | CAIPAssetId;

export interface MiddlewareConfig {
  payTo: PayToAddress;
  network: string | number;
  amount: string;
  facilitator?: FacilitatorConfig;
  settlementMode?: SettlementMode;
}

export interface HttpRequest {
  headers: Record<string, string | string[] | undefined>;
  body?: unknown;
  method?: string;
  url?: string;
}

export interface HttpResponse {
  status: number;
  headers: Record<string, string>;
  body?: unknown;
}

export interface FacilitatorVerifyResult {
  success: boolean;
  payerAddress?: string;
  balance?: string;
  requiredAmount?: string;
  error?: string;
}

export interface FacilitatorSettleResult {
  success: boolean;
  txHash?: string;
  error?: string;
}
