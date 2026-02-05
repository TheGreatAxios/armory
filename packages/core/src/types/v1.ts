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

export const V1_HEADERS = {
  PAYMENT: "X-PAYMENT",
  PAYMENT_RESPONSE: "X-PAYMENT-RESPONSE",
} as const;

export function encodePaymentPayload(payload: PaymentPayloadV1): string {
  return Buffer.from(JSON.stringify(payload)).toString("base64");
}

export function decodePaymentPayload(encoded: string): PaymentPayloadV1 {
  return JSON.parse(Buffer.from(encoded, "base64").toString("utf-8")) as PaymentPayloadV1;
}

export function encodeSettlementResponse(response: SettlementResponseV1): string {
  return Buffer.from(JSON.stringify(response)).toString("base64");
}

export function decodeSettlementResponse(encoded: string): SettlementResponseV1 {
  return JSON.parse(Buffer.from(encoded, "base64").toString("utf-8")) as SettlementResponseV1;
}
