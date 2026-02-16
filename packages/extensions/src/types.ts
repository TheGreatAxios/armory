/**
 * Core extension types for x402 protocol extensions
 * Matching Coinbase @x402/extensions package structure
 */

export interface Extension<T = unknown> {
  info: T;
  schema: JSONSchema;
}

export type JSONSchema = {
  $schema?: string;
  $id?: string;
  title?: string;
  description?: string;
  type?: string | string[];
  properties?: Record<string, JSONSchema>;
  required?: Array<string | boolean>;
  items?: JSONSchema;
  additionalProperties?: boolean | JSONSchema;
  allOf?: JSONSchema[];
  anyOf?: JSONSchema[];
  oneOf?: JSONSchema[];
  not?: JSONSchema;
  enum?: unknown[];
  const?: unknown;
  format?: string;
  pattern?: string;
  minLength?: number;
  maxLength?: number;
  minimum?: number;
  maximum?: number;
  exclusiveMinimum?: number | boolean;
  exclusiveMaximum?: number | boolean;
  multipleOf?: number;
  minItems?: number;
  maxItems?: number;
  uniqueItems?: boolean;
  minProperties?: number;
  maxProperties?: number;
  $ref?: string;
  definitions?: Record<string, JSONSchema>;
  dependencies?: Record<string, JSONSchema | string[]>;
  patternProperties?: Record<string, JSONSchema>;
  additionalItems?: boolean | JSONSchema;
}

export type BazaarExtensionInfo = {
  input?: unknown;
  inputSchema?: JSONSchema;
  output?: {
    example?: unknown;
    schema?: JSONSchema;
  };
};

export type BazaarDiscoveryConfig = {
  input?: unknown;
  inputSchema?: JSONSchema;
  bodyType?: "json" | "form-data" | "text";
  output?: {
    example?: unknown;
    schema?: JSONSchema;
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
  inputSchema?: JSONSchema;
  output?: {
    example?: unknown;
    schema?: JSONSchema;
  };
  network: string;
  token: string;
  amount: string;
  payTo: string;
};

export type BazaarDiscoveryConfig = {
  input?: unknown;
  inputSchema?: JSONSchema;
  bodyType?: "json" | "form-data" | "text";
  output?: {
    example?: unknown;
    schema?: JSONSchema;
  };
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
