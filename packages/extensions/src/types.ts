/**
 * Core extension types for x402 protocol extensions
 * Matching Coinbase @x402/extensions package structure
 */

export interface Extension<T = unknown> {
  info: T;
}

export type BazaarExtensionInfo = {
  input?: unknown;
  inputSchema?: unknown;
  output?: {
    example?: unknown;
    schema?: unknown;
  };
};

export type BazaarDiscoveryConfig = {
  input?: unknown;
  inputSchema?: unknown;
  bodyType?: "json" | "form-data" | "text";
  output?: {
    example?: unknown;
    schema?: unknown;
  };
};

export type SIWxExtensionInfo = {
  domain?: string;
  resourceUri?: string;
  network?: string | string[];
  statement?: string;
  version?: string;
  expirationSeconds?: number;
  supportedChains?: Array<{
    chainId: string;
    type: string;
  }>;
};

export type PaymentIdentifierExtensionInfo = {
  paymentId?: string;
  required?: boolean;
};

export type PaymentIdentifierConfig = {
  paymentId?: string;
  required?: boolean;
};

export type SIWxPayload = {
  domain: string;
  resourceUri?: string;
  address: string;
  statement?: string;
  version?: string;
  chainId?: string | string[];
  expirationTime?: string;
  issuedAt?: string;
  nonce?: string;
  signature?: string;
};

export type DiscoveredResource = {
  input?: unknown;
  inputSchema?: unknown;
  output?: {
    example?: unknown;
    schema?: unknown;
  };
  network: string;
  token: string;
  amount: string;
  payTo: string;
};

export type SIWxExtensionConfig = {
  domain?: string;
  resourceUri?: string;
  network?: string | string[];
  statement?: string;
  version?: string;
  expirationSeconds?: number;
};

export const BAZAAR = "bazaar";
export const SIGN_IN_WITH_X = "sign-in-with-x";
export const PAYMENT_IDENTIFIER = "payment-identifier";
