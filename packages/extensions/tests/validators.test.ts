import { describe, expect, test } from "bun:test";
import { type } from "arktype";
import {
  createExtension,
  extractExtension,
  validateExtension,
} from "../src/validators";

describe("[unit|extensions]: Validators", () => {
  describe("[unit|extensions]: createExtension", () => {
    test("[createExtension|success] - creates extension with info", () => {
      const info = { test: "value" };

      const extension = createExtension(info);

      expect(extension.info).toEqual(info);
    });
  });

  describe("[unit|extensions]: extractExtension", () => {
    test("[extractExtension|success] - extracts existing extension", () => {
      const info = { test: "value" };
      const extensions = {
        test: { info },
      };

      const result = extractExtension(extensions, "test");

      expect(result).not.toBeNull();
      expect(result?.info).toEqual(info);
    });

    test("[extractExtension|error] - returns null for undefined extensions", () => {
      const result = extractExtension(undefined, "test");

      expect(result).toBeNull();
    });

    test("[extractExtension|error] - returns null for non-object extensions", () => {
      const result = extractExtension("string" as any, "test");

      expect(result).toBeNull();
    });

    test("[extractExtension|error] - returns null for missing key", () => {
      const extensions = { other: { info: {} } };

      const result = extractExtension(extensions, "missing");

      expect(result).toBeNull();
    });

    test("[extractExtension|error] - returns null for non-object extension value", () => {
      const extensions = { test: "string" };

      const result = extractExtension(extensions, "test");

      expect(result).toBeNull();
    });
  });

  describe("[unit|extensions]: validateExtension", () => {
    const PersonType = type({
      name: "string",
      age: "number",
    });

    test("[validateExtension|success] - validates valid data", () => {
      const validData = { name: "Bob", age: 25 };
      const result = validateExtension(PersonType, validData);

      expect(result.valid).toBe(true);
      expect(result.errors).toBeUndefined();
    });

    test("[validateExtension|error] - rejects invalid data", () => {
      const invalidData = { name: 123 };
      const result = validateExtension(PersonType, invalidData);

      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors?.length).toBeGreaterThan(0);
    });

    test("[validateExtension|success] - validates with partial types", () => {
      const OptionalPersonType = type({
        name: "string",
        age: "number",
      }).partial();

      const validData = { name: "Alice" };
      const result = validateExtension(OptionalPersonType, validData);

      expect(result.valid).toBe(true);
    });

    test("[validateExtension|error] - provides helpful error messages", () => {
      const invalidData = { age: "not a number" };
      const result = validateExtension(PersonType, invalidData);

      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
    });
  });
});
