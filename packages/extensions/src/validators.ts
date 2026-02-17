/**
 * JSON Schema validators for x402 extensions
 */

import Ajv from "ajv";
import type { JSONSchema, Extension } from "./types.js";

let ajvInstance: Ajv | null = null;

function getAjv(): Ajv {
  if (!ajvInstance) {
    ajvInstance = new Ajv({
      allErrors: true,
      strict: false,
    });
  }
  return ajvInstance;
}

export function validateExtension<T>(
  extension: Extension<T>,
  data: unknown
): { valid: boolean; errors?: string[] } {
  const ajv = getAjv();
  const validate = ajv.compile(extension.schema);

  if (validate(data)) {
    return { valid: true };
  }

  const errors = validate.errors?.map((err) => {
    let path = "";
    if (err.instancePath) {
      path = err.instancePath;
    } else if (err.schemaPath && Array.isArray(err.schemaPath)) {
      path = err.schemaPath.join(".");
    }
    return `${path}: ${err.message || "validation error"}`;
  });

  return { valid: false, errors };
}

export function extractExtension<T>(
  extensions: Record<string, unknown> | undefined,
  key: string
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

export function createExtension<T>(
  info: T,
  schema: JSONSchema
): Extension<T> {
  return { info, schema };
}

export type ValidationError = {
  keyword: string;
  instancePath: string;
  schemaPath: string[];
  params?: Record<string, unknown>;
  message?: string;
};

export type ValidationResult = {
  valid: boolean;
  errors?: ValidationError[];
};

export function validateWithSchema(
  schema: JSONSchema,
  data: unknown
): ValidationResult {
  const ajv = getAjv();
  const validate = ajv.compile(schema);

  if (validate(data)) {
    return { valid: true };
  }

  return {
    valid: false,
    errors: validate.errors || [],
  };
}
