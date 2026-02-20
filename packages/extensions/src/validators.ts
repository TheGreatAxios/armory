/**
 * Type validators for x402 extensions
 */

import type { Type } from "arktype";
import { type } from "arktype";
import type { Extension } from "./types.js";

export function validateExtension<T>(
  extensionType: Type<T>,
  data: unknown,
): { valid: boolean; errors?: string[] } {
  const out = extensionType(data);
  if (out instanceof type.errors) {
    return {
      valid: false,
      errors: out.map((e) => `${e.path.join(".")}: ${e.message}`),
    };
  }
  return { valid: true };
}

export function extractExtension<T>(
  extensions: Record<string, unknown> | undefined,
  key: string,
): Extension<T> | null {
  if (!extensions || typeof extensions !== "object") {
    return null;
  }

  const extension = extensions[key];
  if (!extension || typeof extension !== "object") {
    return null;
  }

  return extension as Extension<T>;
}

export function createExtension<T>(info: T): Extension<T> {
  return { info };
}
