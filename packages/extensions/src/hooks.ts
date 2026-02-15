/**
 * Extension Hook Creators
 *
 * Provides convenient functions for creating hooks that handle
 * common x402 protocol extensions like Sign-In-With-X and Payment Identifier.
 *
 * Hooks can be registered with x402 clients to automatically handle
 * extension requirements from servers.
 */

import type { SIWxExtensionInfo, SIWxPayload, PaymentIdentifierExtensionInfo } from "./types";
import {
  createSIWxPayload,
  encodeSIWxHeader,
  createSIWxMessage,
} from "./sign-in-with-x";
import {
  generatePaymentId,
  appendPaymentIdentifierToExtensions,
} from "./payment-identifier";
import type {
  HookConfig,
  PaymentPayloadContext,
  PaymentRequiredContext,
  ExtensionHook,
} from "@armory-sh/base";

export interface SIWxHookConfig {
  domain?: string;
  statement?: string;
  expirationSeconds?: number;
}

export interface PaymentIdHookConfig {
  paymentId?: string;
}

type HookContext = PaymentRequiredContext | PaymentPayloadContext<unknown>;

export function createSIWxHook(
  config?: SIWxHookConfig
): HookConfig {
  return {
    hook: async (context: HookContext) => {
      if (!context.payload) return;

      const serverExtensions = context.paymentContext?.serverExtensions;
      const siwxInfo = serverExtensions?.["sign-in-with-x"];
      if (!siwxInfo?.info) return;

      const info = siwxInfo.info as SIWxExtensionInfo;
      const address = context.paymentContext?.fromAddress;
      const nonce = context.paymentContext?.nonce;

      if (!address || !nonce) return;

      const payload = createSIWxPayload(info, address, {
        nonce: nonce.slice(2),
        issuedAt: new Date().toISOString(),
      });

      const message = createSIWxMessage(payload);

      const wallet = context.wallet;
      let signature: string;
      if (wallet.type === "account") {
        signature = await wallet.account.signMessage({ message });
      } else if (wallet.type === "walletClient") {
        signature = await wallet.walletClient.account.signMessage({ message });
      } else {
        return;
      }

      payload.signature = signature;
      const header = encodeSIWxHeader(payload);

      context.payload.extensions = {
        ...(context.payload.extensions ?? {}),
        "sign-in-with-x": header,
      };
    },
    priority: 100,
    name: "sign-in-with-x",
  };
}

export function createPaymentIdHook(
  config?: PaymentIdHookConfig
): HookConfig {
  const state = { paymentId: config?.paymentId };

  return {
    hook: async (context: HookContext) => {
      if (context.serverExtensions) {
        const paymentIdExt = context.serverExtensions["payment-identifier"];
        if (paymentIdExt && typeof paymentIdExt === "object") {
          const info = (paymentIdExt as { info?: PaymentIdentifierExtensionInfo }).info;
          if (info?.required && !state.paymentId) {
            state.paymentId = generatePaymentId();
          }
        }
      }

      if (context.payload && state.paymentId) {
        context.payload.extensions = appendPaymentIdentifierToExtensions(
          context.payload.extensions,
          state.paymentId
        );
      }
    },
    priority: 50,
    name: "payment-identifier",
  };
}

export function createCustomHook(config: {
  key: string;
  handler: (context: any) => void | Promise<void>;
  priority?: number;
}): HookConfig {
  return {
    hook: config.handler,
    priority: config.priority ?? 0,
    name: config.key,
  };
}
