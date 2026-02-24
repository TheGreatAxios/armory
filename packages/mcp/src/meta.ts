import type {
  PaymentRequiredV2,
  SettlementResponseV2,
  X402PaymentPayload,
} from "@armory-sh/base";
import { isPaymentPayload } from "@armory-sh/base";
import type { McpMeta, McpPaymentRequiredData, McpToolContent, McpToolResult } from "./types";
import {
  META_PAYMENT_KEY,
  META_PAYMENT_RESPONSE_KEY,
  META_PAYMENT_REQUIRED_KEY,
} from "./types";

export function extractPaymentFromMeta(
  meta: McpMeta | undefined,
): X402PaymentPayload | undefined {
  if (!meta) return undefined;
  const raw = meta[META_PAYMENT_KEY];
  if (!raw || typeof raw !== "object") return undefined;
  if (isPaymentPayload(raw)) return raw as X402PaymentPayload;
  return undefined;
}

export function attachPaymentToMeta(
  meta: McpMeta | undefined,
  payload: X402PaymentPayload,
): McpMeta {
  return { ...(meta ?? {}), [META_PAYMENT_KEY]: payload };
}

export function attachPaymentResponseToMeta(
  meta: McpMeta | undefined,
  settlement: SettlementResponseV2,
): McpMeta {
  return { ...(meta ?? {}), [META_PAYMENT_RESPONSE_KEY]: settlement };
}

export function extractPaymentResponseFromMeta(
  meta: McpMeta | undefined,
): SettlementResponseV2 | undefined {
  if (!meta) return undefined;
  const raw = meta[META_PAYMENT_RESPONSE_KEY];
  if (!raw || typeof raw !== "object") return undefined;
  const record = raw as Record<string, unknown>;
  if (typeof record.success !== "boolean" || typeof record.transaction !== "string") {
    return undefined;
  }
  return raw as SettlementResponseV2;
}

export function createPaymentRequiredResult(
  paymentRequired: McpPaymentRequiredData,
): McpToolResult {
  const structuredContent = paymentRequired as unknown as Record<string, unknown>;
  const textContent: McpToolContent = {
    type: "text",
    text: JSON.stringify(paymentRequired),
  };
  return {
    content: [textContent],
    structuredContent,
    isError: true,
  };
}

export function extractPaymentRequiredFromResult(
  result: McpToolResult,
): PaymentRequiredV2 | undefined {
  if (result.structuredContent) {
    const sc = result.structuredContent;
    if (sc.x402Version === 2 && Array.isArray(sc.accepts)) {
      return sc as unknown as PaymentRequiredV2;
    }
  }

  if (result.content && result.content.length > 0) {
    const first = result.content[0];
    if (first && first.type === "text" && first.text) {
      try {
        const parsed = JSON.parse(first.text) as Record<string, unknown>;
        if (parsed.x402Version === 2 && Array.isArray(parsed.accepts)) {
          return parsed as unknown as PaymentRequiredV2;
        }
      } catch {
        return undefined;
      }
    }
  }

  return undefined;
}
