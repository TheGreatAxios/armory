import { describe, test, expect } from "bun:test";
import {
  validateExtension,
  extractExtension,
  createExtension,
  validateWithSchema,
} from "../src/validators";
import type { JSONSchema } from "../src/types";

describe("[unit|extensions]: Validators", () => {
  describe("[unit|extensions]: createExtension", () => {
    test("[createExtension|success] - creates extension with info and schema", () => {
      const info = { test: "value" };
      const schema: JSONSchema = {
        type: "object",
        properties: {
          test: { type: "string" },
        },
      };

      const extension = createExtension(info, schema);

      expect(extension.info).toEqual(info);
      expect(extension.schema).toEqual(schema);
    });
  });

  describe("[unit|extensions]: extractExtension", () => {
    test("[extractExtension|success] - extracts existing extension", () => {
      const info = { test: "value" };
      const schema: JSONSchema = { type: "object" };
      const extensions = {
        test: { info, schema },
      };

      const result = extractExtension(extensions, "test");

      expect(result).not.toBeNull();
      expect(result?.info).toEqual(info);
      expect(result?.schema).toEqual(schema);
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
      const extensions = { other: { info: {}, schema: {} } };

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
    test("[validateExtension|success] - validates data against schema", async () => {
      const schema: JSONSchema = {
        type: "object",
        properties: {
          name: { type: "string" },
          age: { type: "number" },
        },
        required: ["name", "age"],
      };

      const extension = createExtension(
        { name: "Alice", age: 30 },
        schema
      );

      const validData = { name: "Bob", age: 25 };
      const result = await validateExtension(extension, validData);

      expect(result.valid).toBe(true);
      expect(result.errors).toBeUndefined();
    });

    test("[validateExtension|error] - rejects invalid data", async () => {
      const schema: JSONSchema = {
        type: "object",
        properties: {
          name: { type: "string" },
          age: { type: "number" },
        },
        required: ["name", "age"],
      };

      const extension = createExtension(
        { name: "Alice", age: 30 },
        schema
      );

      const invalidData = { name: 123 as any };
      const result = await validateExtension(extension, invalidData);

      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors?.length).toBeGreaterThan(0);
    });

    test("[validateExtension|success] - handles optional properties", async () => {
      const schema: JSONSchema = {
        type: "object",
        properties: {
          name: { type: "string" },
          age: { type: "number" },
        },
        required: ["name"],
      };

      const extension = createExtension({ name: "Alice" }, schema);

      const validData = { name: "Bob" };
      const result = await validateExtension(extension, validData);

      expect(result.valid).toBe(true);
    });
  });

  describe("[unit|extensions]: validateWithSchema", () => {
    test("[validateWithSchema|success] - validates valid data", async () => {
      const schema: JSONSchema = {
        type: "object",
        properties: {
          email: { type: "string", format: "email" },
        },
        required: ["email"],
      };

      const result = await validateWithSchema(schema, { email: "test@example.com" });

      expect(result.valid).toBe(true);
      expect(result.errors).toBeUndefined();
    });

    test("[validateWithSchema|error] - returns errors for invalid data", async () => {
      const schema: JSONSchema = {
        type: "object",
        properties: {
          count: { type: "number", minimum: 0 },
        },
        required: ["count"],
      };

      const result = await validateWithSchema(schema, { count: -1 });

      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors?.length).toBeGreaterThan(0);
    });

    test("[validateWithSchema|success] - validates complex schemas", async () => {
      const schema: JSONSchema = {
        type: "object",
        properties: {
          user: {
            type: "object",
            properties: {
              name: { type: "string" },
              address: {
                type: "object",
                properties: {
                  street: { type: "string" },
                  city: { type: "string" },
                },
                required: ["street", "city"],
              },
            },
            required: ["name", "address"],
          },
        },
        required: ["user"],
      };

      const result = await validateWithSchema(schema, {
        user: {
          name: "Alice",
          address: {
            street: "123 Main St",
            city: "San Francisco",
          },
        },
      });

      expect(result.valid).toBe(true);
    });
  });
});
