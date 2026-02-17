/**
 * Bazaar Discovery Extension for x402
 * Enables automatic cataloging of x402-enabled resources
 */

import type { PaymentPayloadV2, PaymentRequirementsV2 } from "@armory-sh/base";
import { type } from "arktype";
import type {
  BazaarDiscoveryConfig,
  BazaarExtensionInfo,
  DiscoveredResource,
  Extension,
} from "./types.js";
import { BAZAAR } from "./types.js";
import { createExtension, extractExtension } from "./validators.js";

const BazaarInfoType = type({
  input: "unknown",
  inputSchema: "unknown",
  output: type({
    example: "unknown",
    schema: "unknown",
  }).optional(),
});

export function declareDiscoveryExtension(
  config: BazaarDiscoveryConfig = {},
): Extension<BazaarExtensionInfo> {
  const info: BazaarExtensionInfo = {};

  if (config.input !== undefined) {
    info.input = config.input;
  }

  if (config.inputSchema !== undefined) {
    info.inputSchema = config.inputSchema;
  }

  if (config.output !== undefined) {
    info.output = config.output;
  }

  return createExtension(info);
}

export function extractDiscoveryInfo(
  paymentPayload: PaymentPayloadV2,
  paymentRequirements: PaymentRequirementsV2,
  _validate = true,
): DiscoveredResource | null {
  const extensions = paymentPayload.extensions;
  const bazaarExtension = extractExtension<BazaarExtensionInfo>(
    extensions,
    BAZAAR,
  );

  if (!bazaarExtension) {
    return null;
  }

  return {
    input: bazaarExtension.info.input,
    inputSchema: bazaarExtension.info.inputSchema,
    output: bazaarExtension.info.output,
    network: paymentRequirements.network,
    token: paymentRequirements.asset,
    amount: paymentRequirements.amount,
    payTo: paymentRequirements.payTo,
  };
}

export function validateDiscoveryExtension(extension: unknown): {
  valid: boolean;
  errors?: string[];
} {
  if (!extension || typeof extension !== "object") {
    return { valid: false, errors: ["Extension must be an object"] };
  }

  const ext = extension as Record<string, unknown>;

  if (!("info" in ext) || typeof ext.info !== "object") {
    return { valid: false, errors: ["Extension must have an 'info' field"] };
  }

  return { valid: true };
}

export function createDiscoveryConfig(
  config: BazaarDiscoveryConfig,
): BazaarDiscoveryConfig {
  return config;
}

export function isDiscoveryExtension(
  extension: unknown,
): extension is Extension<BazaarExtensionInfo> {
  if (!extension || typeof extension !== "object") {
    return false;
  }

  const ext = extension as Record<string, unknown>;
  return "info" in ext;
}

export { BAZAAR, BazaarInfoType };
