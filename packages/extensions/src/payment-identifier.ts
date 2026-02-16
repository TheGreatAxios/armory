/**
 * Payment Identifier Extension for x402
 * Enables idempotency for x402 payments
 *
 * Specification: https://docs.x402.org/extensions/payment-identifier
 */

import type {
  Extension,
  PaymentIdentifierExtensionInfo,
  PaymentIdentifierConfig,
  JSONSchema,
} from "./types.js";
import { createExtension } from "./validators.js";
import type { PaymentPayloadV2, PaymentRequirementsV2 } from "@armory-sh/base";

const PAYMENT_ID_ALLOWED_CHARS = /^[a-z0-9_-]+$/;
const PAYMENT_ID_MIN_LENGTH = 3;
const PAYMENT_ID_MAX_LENGTH = 128;

export function generatePaymentId(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789-_";
  let result = "";
  for (let i = 0; i < 32; i++) {
    const randomIndex = Math.floor(Math.random() * chars.length);
    result += chars[randomIndex];
  }
  return result;
}

export function appendPaymentIdentifierToExtensions(
  extensions: Record<string, unknown> | undefined,
  paymentId: string
): Record<string, unknown> {
  const existing = extensions || {};
  const extension: PaymentIdentifierExtensionInfo = {
    paymentId,
  };

  return {
    ...existing,
    "payment-identifier": extension,
  };
}

export function extractPaymentIdentifierInfo(
  paymentPayload: PaymentPayloadV2
): string | null {
  const extensions = paymentPayload.extensions;
  if (!extensions || typeof extensions !== "object") {
    return null;
  }

  const identifierExt = extensions["payment-identifier"];
  if (!identifierExt || typeof identifierExt !== "object") {
    return null;
  }

  const ext = identifierExt as { info: { paymentId?: string } };
  return ext.info?.paymentId || null;
}

export function isValidPaymentId(paymentId: string): boolean {
  if (typeof paymentId !== "string") {
    return false;
  }

  if (paymentId.length < PAYMENT_ID_MIN_LENGTH) {
    return false;
  }

  if (paymentId.length > PAYMENT_ID_MAX_LENGTH) {
    return false;
  }

  return PAYMENT_ID_ALLOWED_CHARS.test(paymentId);
}

export function validatePaymentIdentifierExtension(
  extension: unknown
): { valid: boolean; errors?: string[] } {
  if (!extension || typeof extension !== "object") {
    return { valid: false, errors: ["Extension must be an object"] };
  }

  const ext = extension as Record<string, unknown>;

  if (!("info" in ext) || typeof ext.info !== "object") {
    return { valid: false, errors: ["Extension must have an 'info' field"] };
  }

  const info = ext.info as PaymentIdentifierExtensionInfo;

  if (info.paymentId !== undefined) {
    if (typeof info.paymentId !== "string") {
      return { valid: false, errors: ["paymentId must be a string when defined"] };
    }

    if (info.paymentId.length > PAYMENT_ID_MAX_LENGTH) {
      return { valid: false, errors: ["must be 128 characters or fewer"] };
    }

    if (info.paymentId.length < PAYMENT_ID_MIN_LENGTH) {
      return {
        valid: false,
        errors: [`must be at least ${PAYMENT_ID_MIN_LENGTH} characters`],
      };
    }

    if (!PAYMENT_ID_ALLOWED_CHARS.test(info.paymentId)) {
      return {
        valid: false,
        errors: ["alphanumeric, hyphens, and underscores only"],
      };
    }
  }

  if (info.required !== undefined && typeof info.required !== "boolean") {
    return { valid: false, errors: ["required must be a boolean"] };
  }

  return { valid: true };
}

export function isPaymentIdentifierExtension(
  extension: unknown
): extension is Extension<PaymentIdentifierExtensionInfo> {
  if (!extension || typeof extension !== "object") {
    return false;
  }

  const ext = extension as Record<string, unknown>;
  return "info" in ext && "schema" in ext;
}

export function declarePaymentIdentifierExtension(
  config: PaymentIdentifierConfig = {}
): Extension<PaymentIdentifierExtensionInfo> {
  const info: PaymentIdentifierExtensionInfo = {};

  if (config.paymentId !== undefined) {
    info.paymentId = config.paymentId;
  }

  if (config.required !== undefined) {
    info.required = config.required;
  }

  const paymentIdSchema: JSONSchema = {
    type: "string",
    minLength: PAYMENT_ID_MIN_LENGTH,
    maxLength: PAYMENT_ID_MAX_LENGTH,
    pattern: PAYMENT_ID_ALLOWED_CHARS.source,
    description: "Unique payment identifier for idempotency",
  };

  if (info.required !== undefined) {
    paymentIdSchema.required = [info.required];
  }

  return createExtension(info, {
    type: "object",
    properties: {
      paymentId: paymentIdSchema,
      required: {
        type: "boolean",
        description: "Whether payment identifier is required for this payment",
      },
    },
    required: info.required ? ["paymentId"] : [],
  });
}

export const PAYMENT_IDENTIFIER = "payment-identifier";

export type { PaymentIdentifierExtensionInfo, PaymentIdentifierConfig };
