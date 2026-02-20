/**
 * Extension Hook Creators
 *
 * Provides convenient functions for creating hooks that handle
 * common x402 protocol extensions like Sign-In-With-X and Payment Identifier.
 *
 * Hooks can be registered with x402 clients to automatically handle
 * extension requirements from servers.
 */

import type {
  HookConfig,
  PaymentPayloadContext,
  PaymentRequiredContext,
} from "@armory-sh/base";
import {
  appendPaymentIdentifierToExtensions,
  generatePaymentId,
} from "./payment-identifier";
import {
  createSIWxMessage,
  createSIWxPayload,
  encodeSIWxHeader,
} from "./sign-in-with-x";
import type {
  PaymentIdentifierExtensionInfo,
  SIWxExtensionInfo,
} from "./types";

export interface SIWxHookConfig {
  domain?: string;
  statement?: string;
  expirationSeconds?: number;
}

export interface PaymentIdHookConfig {
  paymentId?: string;
}

function isPayloadContext(
  context: PaymentRequiredContext | PaymentPayloadContext<unknown>,
): context is PaymentPayloadContext<unknown> {
  return "paymentContext" in context && "payload" in context;
}

function hasInfo(value: unknown): value is { info: SIWxExtensionInfo } {
  return typeof value === "object" && value !== null && "info" in value;
}

export function createSIWxHook(_config?: SIWxHookConfig): HookConfig {
  return {
    hook: async (
      context: PaymentRequiredContext | PaymentPayloadContext<unknown>,
    ) => {
      if (isPayloadContext(context)) {
        const ctx = context;
        const serverExtensions = ctx.paymentContext.serverExtensions;
        const siwxInfo = serverExtensions?.["sign-in-with-x"];
        if (!hasInfo(siwxInfo)) return;

        const info = siwxInfo.info;
        const address = ctx.paymentContext.fromAddress;
        const nonce = ctx.paymentContext.nonce;

        if (!address || !nonce) return;

        const payload = createSIWxPayload(info, address, {
          nonce: nonce.slice(2),
          issuedAt: new Date().toISOString(),
        });

        const message = createSIWxMessage(payload);

        const wallet = ctx.wallet;
        let signature: string;
        if (typeof wallet === "object" && wallet !== null) {
          if (
            "type" in wallet &&
            wallet.type === "account" &&
            "account" in wallet &&
            typeof wallet.account === "object" &&
            wallet.account !== null &&
            "signMessage" in wallet.account &&
            typeof wallet.account.signMessage === "function"
          ) {
            signature = await wallet.account.signMessage({ message });
          } else if (
            "type" in wallet &&
            wallet.type === "walletClient" &&
            "walletClient" in wallet &&
            typeof wallet.walletClient === "object" &&
            wallet.walletClient !== null &&
            "account" in wallet.walletClient &&
            typeof wallet.walletClient.account === "object" &&
            wallet.walletClient.account !== null &&
            "signMessage" in wallet.walletClient.account &&
            typeof wallet.walletClient.account.signMessage === "function"
          ) {
            signature = await wallet.walletClient.account.signMessage({
              message,
            });
          } else {
            return;
          }
        } else {
          return;
        }

        payload.signature = signature;
        const header = encodeSIWxHeader(payload);

        ctx.payload.extensions = {
          ...(ctx.payload.extensions ?? {}),
          "sign-in-with-x": header,
        };
      }
    },
    priority: 100,
    name: "sign-in-with-x",
  };
}

export function createPaymentIdHook(config?: PaymentIdHookConfig): HookConfig {
  const state = { paymentId: config?.paymentId };

  return {
    hook: async (
      context: PaymentRequiredContext | PaymentPayloadContext<unknown>,
    ) => {
      if (isPayloadContext(context)) {
        const ctx = context;
        const serverExtensions = ctx.paymentContext.serverExtensions;

        if (serverExtensions) {
          const paymentIdExt = serverExtensions["payment-identifier"];
          if (paymentIdExt && typeof paymentIdExt === "object") {
            const info = (
              paymentIdExt as { info?: PaymentIdentifierExtensionInfo }
            ).info;
            if (info?.required && !state.paymentId) {
              state.paymentId = generatePaymentId();
            }
          }
        }

        if (state.paymentId) {
          ctx.payload.extensions = appendPaymentIdentifierToExtensions(
            ctx.payload.extensions,
            state.paymentId,
          );
        }
      }
    },
    priority: 50,
    name: "payment-identifier",
  };
}

export function createCustomHook(config: {
  key: string;
  handler: (context: unknown) => void | Promise<void>;
  priority?: number;
}): HookConfig {
  return {
    hook: config.handler,
    priority: config.priority ?? 0,
    name: config.key,
  };
}
