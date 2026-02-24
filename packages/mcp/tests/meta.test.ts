import { describe, expect, test } from "bun:test";
import type {
  PaymentRequirementsV2,
  SettlementResponseV2,
  X402PaymentPayload,
} from "@armory-sh/base";
import {
  attachPaymentResponseToMeta,
  attachPaymentToMeta,
  createPaymentRequiredResult,
  extractPaymentFromMeta,
  extractPaymentRequiredFromResult,
  extractPaymentResponseFromMeta,
} from "../src/meta";
import { META_PAYMENT_KEY, META_PAYMENT_RESPONSE_KEY } from "../src/types";
import type { McpPaymentRequiredData, McpToolResult } from "../src/types";

const TEST_REQUIREMENT: PaymentRequirementsV2 = {
  scheme: "exact",
  network: "eip155:84532",
  amount: "1000000",
  asset: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
  payTo: "0x209693Bc6afc0C5328bA36FaF03C514EF312287C",
  maxTimeoutSeconds: 60,
};

const TEST_PAYLOAD: X402PaymentPayload = {
  x402Version: 2,
  accepted: TEST_REQUIREMENT,
  payload: {
    signature: `0x${"a".repeat(130)}` as `0x${string}`,
    authorization: {
      from: "0x857b06519E91e3A54538791bDbb0E22373e36b66",
      to: "0x209693Bc6afc0C5328bA36FaF03C514EF312287C",
      value: "1000000",
      validAfter: "0",
      validBefore: "9999999999",
      nonce: `0x${"1".repeat(64)}` as `0x${string}`,
    },
  },
};

const TEST_SETTLEMENT: SettlementResponseV2 = {
  success: true,
  transaction: "0xabc123",
  network: "eip155:84532",
  payer: "0x857b06519E91e3A54538791bDbb0E22373e36b66",
};

describe("[unit|mcp]: extractPaymentFromMeta", () => {
  test("[unit|mcp] - [extractPaymentFromMeta|success] - extracts payment from meta", () => {
    const meta = { [META_PAYMENT_KEY]: TEST_PAYLOAD };
    const result = extractPaymentFromMeta(meta);
    expect(result).toBeDefined();
    expect(result?.x402Version).toBe(2);
    expect(result?.accepted.network).toBe("eip155:84532");
  });

  test("[unit|mcp] - [extractPaymentFromMeta|undefined] - returns undefined for empty meta", () => {
    expect(extractPaymentFromMeta(undefined)).toBeUndefined();
    expect(extractPaymentFromMeta({})).toBeUndefined();
  });

  test("[unit|mcp] - [extractPaymentFromMeta|undefined] - returns undefined for invalid data", () => {
    const meta = { [META_PAYMENT_KEY]: "not-an-object" };
    expect(extractPaymentFromMeta(meta)).toBeUndefined();
  });

  test("[unit|mcp] - [extractPaymentFromMeta|undefined] - returns undefined for non-payment object", () => {
    const meta = { [META_PAYMENT_KEY]: { foo: "bar" } };
    expect(extractPaymentFromMeta(meta)).toBeUndefined();
  });
});

describe("[unit|mcp]: attachPaymentToMeta", () => {
  test("[unit|mcp] - [attachPaymentToMeta|success] - attaches payment to empty meta", () => {
    const result = attachPaymentToMeta(undefined, TEST_PAYLOAD);
    expect(result[META_PAYMENT_KEY]).toEqual(TEST_PAYLOAD);
  });

  test("[unit|mcp] - [attachPaymentToMeta|success] - preserves existing meta keys", () => {
    const existing = { "other-key": "value" };
    const result = attachPaymentToMeta(existing, TEST_PAYLOAD);
    expect(result[META_PAYMENT_KEY]).toEqual(TEST_PAYLOAD);
    expect(result["other-key"]).toBe("value");
  });
});

describe("[unit|mcp]: attachPaymentResponseToMeta", () => {
  test("[unit|mcp] - [attachPaymentResponseToMeta|success] - attaches settlement to meta", () => {
    const result = attachPaymentResponseToMeta(undefined, TEST_SETTLEMENT);
    expect(result[META_PAYMENT_RESPONSE_KEY]).toEqual(TEST_SETTLEMENT);
  });

  test("[unit|mcp] - [attachPaymentResponseToMeta|success] - preserves existing meta keys", () => {
    const existing = { "other-key": "value" };
    const result = attachPaymentResponseToMeta(existing, TEST_SETTLEMENT);
    expect(result[META_PAYMENT_RESPONSE_KEY]).toEqual(TEST_SETTLEMENT);
    expect(result["other-key"]).toBe("value");
  });
});

describe("[unit|mcp]: extractPaymentResponseFromMeta", () => {
  test("[unit|mcp] - [extractPaymentResponseFromMeta|success] - extracts settlement from meta", () => {
    const meta = { [META_PAYMENT_RESPONSE_KEY]: TEST_SETTLEMENT };
    const result = extractPaymentResponseFromMeta(meta);
    expect(result).toBeDefined();
    expect(result?.success).toBe(true);
    expect(result?.transaction).toBe("0xabc123");
  });

  test("[unit|mcp] - [extractPaymentResponseFromMeta|undefined] - returns undefined for empty meta", () => {
    expect(extractPaymentResponseFromMeta(undefined)).toBeUndefined();
    expect(extractPaymentResponseFromMeta({})).toBeUndefined();
  });

  test("[unit|mcp] - [extractPaymentResponseFromMeta|undefined] - returns undefined for invalid data", () => {
    const meta = { [META_PAYMENT_RESPONSE_KEY]: { foo: "bar" } };
    expect(extractPaymentResponseFromMeta(meta)).toBeUndefined();
  });
});

describe("[unit|mcp]: createPaymentRequiredResult", () => {
  test("[unit|mcp] - [createPaymentRequiredResult|success] - creates result with structured content and text fallback", () => {
    const paymentRequired: McpPaymentRequiredData = {
      x402Version: 2,
      error: "Payment required",
      resource: {
        url: "mcp://tool/test",
        description: "Test tool",
        mimeType: "application/json",
      },
      accepts: [TEST_REQUIREMENT],
    };

    const result = createPaymentRequiredResult(paymentRequired);

    expect(result.isError).toBe(true);
    expect(result.structuredContent).toBeDefined();
    expect(result.structuredContent?.x402Version).toBe(2);
    expect(result.structuredContent?.accepts).toBeDefined();
    expect(result.content).toHaveLength(1);
    expect(result.content[0]?.type).toBe("text");

    const parsed = JSON.parse(result.content[0]!.text);
    expect(parsed.x402Version).toBe(2);
    expect(parsed.accepts).toHaveLength(1);
  });
});

describe("[unit|mcp]: extractPaymentRequiredFromResult", () => {
  test("[unit|mcp] - [extractPaymentRequiredFromResult|success] - extracts from structuredContent", () => {
    const result: McpToolResult = {
      content: [{ type: "text", text: "ignored" }],
      structuredContent: {
        x402Version: 2,
        accepts: [TEST_REQUIREMENT],
        error: "Payment required",
        resource: { url: "mcp://tool/test" },
      },
      isError: true,
    };

    const extracted = extractPaymentRequiredFromResult(result);
    expect(extracted).toBeDefined();
    expect(extracted?.x402Version).toBe(2);
    expect(extracted?.accepts).toHaveLength(1);
  });

  test("[unit|mcp] - [extractPaymentRequiredFromResult|success] - falls back to content[0].text", () => {
    const paymentRequired = {
      x402Version: 2,
      accepts: [TEST_REQUIREMENT],
      error: "Payment required",
      resource: { url: "mcp://tool/test" },
    };

    const result: McpToolResult = {
      content: [{ type: "text", text: JSON.stringify(paymentRequired) }],
      isError: true,
    };

    const extracted = extractPaymentRequiredFromResult(result);
    expect(extracted).toBeDefined();
    expect(extracted?.x402Version).toBe(2);
  });

  test("[unit|mcp] - [extractPaymentRequiredFromResult|undefined] - returns undefined for non-payment result", () => {
    const result: McpToolResult = {
      content: [{ type: "text", text: "just a normal result" }],
    };

    expect(extractPaymentRequiredFromResult(result)).toBeUndefined();
  });

  test("[unit|mcp] - [extractPaymentRequiredFromResult|undefined] - returns undefined for empty content", () => {
    const result: McpToolResult = { content: [] };
    expect(extractPaymentRequiredFromResult(result)).toBeUndefined();
  });
});
