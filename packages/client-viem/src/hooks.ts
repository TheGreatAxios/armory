/**
 * Viem-Specific Hook Types
 *
 * Extends the base hook types with viem-specific wallet context.
 * Provides type-safe hook registration for client-viem.
 */

import type {
  HookConfig,
  HookRegistry,
  PaymentPayloadContext,
} from "@armory-sh/base";
import type { X402Wallet } from "./protocol";

export type {
  HookConfig,
  HookRegistry,
  PaymentPayloadContext,
  PaymentRequiredContext,
} from "@armory-sh/base";

export interface ViemPaymentPayloadContext extends PaymentPayloadContext {
  wallet: X402Wallet;
}

export type ViemHookConfig = HookConfig<X402Wallet>;
export type ViemHookRegistry = HookRegistry<X402Wallet>;
