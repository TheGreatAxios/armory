/**
 * Extension Hook System Types
 *
 * Provides a generic hook system for x402 clients to register
 * extension handlers that can modify payment payloads or respond
 * to payment requirements.
 *
 * Hooks allow extensibility without custom code in each client package.
 */

import type {
  Address,
  Extensions,
  PaymentPayloadV2,
  PaymentRequirementsV2,
} from "./v2";

export interface PaymentRequiredContext {
  url: RequestInfo | URL;
  requestInit: RequestInit | undefined;
  requirements: PaymentRequirementsV2;
  serverExtensions: Extensions | undefined;
  fromAddress: Address;
  nonce: `0x${string}`;
  validBefore: number;
}

export interface PaymentPayloadContext<TWallet = unknown> {
  payload: PaymentPayloadV2;
  requirements: PaymentRequirementsV2;
  wallet: TWallet;
  paymentContext: PaymentRequiredContext;
}

export type HookResult = void | Promise<void>;

export type OnPaymentRequiredHook<TWallet = unknown> = (
  context: PaymentRequiredContext,
) => HookResult;

export type BeforePaymentHook<TWallet = unknown> = (
  context: PaymentPayloadContext<TWallet>,
) => HookResult;

export type ExtensionHook<TWallet = unknown> =
  | OnPaymentRequiredHook<TWallet>
  | BeforePaymentHook<TWallet>;

export interface HookConfig<TWallet = unknown> {
  hook: ExtensionHook<TWallet>;
  priority?: number;
  name?: string;
}

export type HookRegistry<TWallet = unknown> = Record<
  string,
  HookConfig<TWallet>
>;
