import type {
  X402PaymentRequirements,
  PayToAddress,
  FacilitatorConfig,
  FacilitatorVerifyResult,
  FacilitatorSettleResult,
  SettlementMode,
} from "@armory-sh/base";

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
