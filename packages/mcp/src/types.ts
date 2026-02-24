import type {
  FacilitatorClientConfig,
  PaymentRequirementsV2,
  PaymentRequiredV2,
  ResourceInfo,
  SettlementResponseV2,
  X402PaymentPayload,
} from "@armory-sh/base";

export const META_PAYMENT_KEY = "x402/payment" as const;
export const META_PAYMENT_REQUIRED_KEY = "x402/payment-required" as const;
export const META_PAYMENT_RESPONSE_KEY = "x402/payment-response" as const;

export type McpMeta = Record<string, unknown>;

export interface McpToolContent {
  type: "text";
  text: string;
}

export interface McpToolResult {
  content: McpToolContent[];
  structuredContent?: Record<string, unknown>;
  isError?: boolean;
  _meta?: McpMeta;
}

export interface McpPaymentRequiredData extends PaymentRequiredV2 {}

export interface McpPaymentWrapperConfig {
  accepts: PaymentRequirementsV2 | PaymentRequirementsV2[];
  resource?: ResourceInfo;
  facilitatorUrl?: string;
  facilitatorUrlByChain?: Record<string, string>;
  facilitatorUrlByToken?: Record<string, Record<string, string>>;
}

export interface McpPaymentContext {
  payload: X402PaymentPayload;
  payerAddress: string;
  verified: boolean;
  requirement: PaymentRequirementsV2;
  facilitatorConfig: FacilitatorClientConfig;
}

export interface McpVerifyHook {
  (context: McpPaymentContext): void | Promise<void>;
}

export interface McpSettleHook {
  (context: McpPaymentContext, settlement: SettlementResponseV2): void | Promise<void>;
}

export interface McpPaymentHooks {
  onVerify?: McpVerifyHook;
  onSettle?: McpSettleHook;
}

export type McpToolHandler<TArgs = Record<string, unknown>> = (
  args: TArgs,
  context: { payment: McpPaymentContext },
) => McpToolResult | Promise<McpToolResult>;
