import { describe, expect, mock, test } from "bun:test";
import type { PaymentRequirementsV2, X402PaymentPayload } from "@armory-sh/base";
import { createMcpPaymentWrapper } from "../src/wrapper";
import { META_PAYMENT_KEY, META_PAYMENT_RESPONSE_KEY } from "../src/types";
import type { McpPaymentContext, McpToolResult } from "../src/types";

const TEST_REQUIREMENT: PaymentRequirementsV2 = {
  scheme: "exact",
  network: "eip155:84532",
  amount: "1000000",
  asset: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
  payTo: "0x209693Bc6afc0C5328bA36FaF03C514EF312287C",
  maxTimeoutSeconds: 60,
};

const TEST_PAYER = "0x857b06519E91e3A54538791bDbb0E22373e36b66";

function createTestPayload(
  requirement: PaymentRequirementsV2,
): X402PaymentPayload {
  return {
    x402Version: 2,
    accepted: requirement,
    payload: {
      signature: `0x${"b".repeat(130)}` as `0x${string}`,
      authorization: {
        from: TEST_PAYER as `0x${string}`,
        to: requirement.payTo,
        value: requirement.amount,
        validAfter: "0",
        validBefore: "9999999999",
        nonce: `0x${"1".repeat(64)}` as `0x${string}`,
      },
    },
  };
}

describe("[unit|mcp]: createMcpPaymentWrapper", () => {
  test("[unit|mcp] - [createMcpPaymentWrapper|paymentRequired] - returns payment required when no payment in meta", async () => {
    const handler = mock(() => ({
      content: [{ type: "text" as const, text: "result" }],
    }));

    const wrappedTool = createMcpPaymentWrapper(
      "test_tool",
      {
        accepts: TEST_REQUIREMENT,
        facilitatorUrl: "https://facilitator.test",
      },
      handler,
    );

    const result = await wrappedTool({}, undefined);

    expect(result.isError).toBe(true);
    expect(result.structuredContent).toBeDefined();
    expect(result.structuredContent?.x402Version).toBe(2);
    expect(result.structuredContent?.accepts).toBeDefined();
    expect(result.content).toHaveLength(1);

    const parsed = JSON.parse(result.content[0]!.text);
    expect(parsed.x402Version).toBe(2);
    expect(parsed.accepts).toHaveLength(1);
    expect(parsed.resource.url).toBe("mcp://tool/test_tool");

    expect(handler).not.toHaveBeenCalled();
  });

  test("[unit|mcp] - [createMcpPaymentWrapper|paymentRequired] - returns payment required when meta has no payment", async () => {
    const handler = mock(() => ({
      content: [{ type: "text" as const, text: "result" }],
    }));

    const wrappedTool = createMcpPaymentWrapper(
      "test_tool",
      {
        accepts: TEST_REQUIREMENT,
        facilitatorUrl: "https://facilitator.test",
      },
      handler,
    );

    const result = await wrappedTool({}, { "some-other-key": "value" });

    expect(result.isError).toBe(true);
    expect(handler).not.toHaveBeenCalled();
  });

  test("[unit|mcp] - [createMcpPaymentWrapper|success] - verifies payment, runs handler, settles, and returns result with settlement meta", async () => {
    const originalFetch = global.fetch;
    global.fetch = mock(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/verify")) {
        return new Response(
          JSON.stringify({ isValid: true, payer: TEST_PAYER }),
          { status: 200 },
        );
      }
      if (url.endsWith("/settle")) {
        return new Response(
          JSON.stringify({
            success: true,
            transaction: "0xtx123",
            network: "eip155:84532",
            payer: TEST_PAYER,
          }),
          { status: 200 },
        );
      }
      return new Response("Not Found", { status: 404 });
    }) as typeof fetch;

    try {
      const handler = mock(
        (_args: Record<string, unknown>, _ctx: { payment: McpPaymentContext }) => ({
          content: [{ type: "text" as const, text: "Tool executed successfully" }],
        }),
      );

      const wrappedTool = createMcpPaymentWrapper(
        "test_tool",
        {
          accepts: TEST_REQUIREMENT,
          facilitatorUrl: "https://facilitator.test",
        },
        handler,
      );

      const payload = createTestPayload(TEST_REQUIREMENT);
      const meta = { [META_PAYMENT_KEY]: payload };
      const result = await wrappedTool({}, meta);

      expect(result.isError).toBeUndefined();
      expect(result.content[0]!.text).toBe("Tool executed successfully");
      expect(result._meta).toBeDefined();
      expect(result._meta?.[META_PAYMENT_RESPONSE_KEY]).toBeDefined();

      const settlement = result._meta![META_PAYMENT_RESPONSE_KEY] as Record<string, unknown>;
      expect(settlement.success).toBe(true);
      expect(settlement.transaction).toBe("0xtx123");

      expect(handler).toHaveBeenCalledTimes(1);
    } finally {
      global.fetch = originalFetch;
    }
  });

  test("[unit|mcp] - [createMcpPaymentWrapper|error] - returns error when accepted requirement not configured", async () => {
    const handler = mock(() => ({
      content: [{ type: "text" as const, text: "result" }],
    }));

    const wrappedTool = createMcpPaymentWrapper(
      "test_tool",
      {
        accepts: TEST_REQUIREMENT,
        facilitatorUrl: "https://facilitator.test",
      },
      handler,
    );

    const wrongRequirement: PaymentRequirementsV2 = {
      ...TEST_REQUIREMENT,
      network: "eip155:1",
      asset: "0x0000000000000000000000000000000000000001",
      payTo: "0x0000000000000000000000000000000000000002",
    };

    const payload = createTestPayload(wrongRequirement);
    const meta = { [META_PAYMENT_KEY]: payload };
    const result = await wrappedTool({}, meta);

    expect(result.isError).toBe(true);
    const parsed = JSON.parse(result.content[0]!.text);
    expect(parsed.error).toBe("Invalid payment");
    expect(handler).not.toHaveBeenCalled();
  });

  test("[unit|mcp] - [createMcpPaymentWrapper|error] - returns error when verification fails", async () => {
    const originalFetch = global.fetch;
    global.fetch = mock(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/verify")) {
        return new Response(
          JSON.stringify({ isValid: false, invalidReason: "expired" }),
          { status: 200 },
        );
      }
      return new Response("Not Found", { status: 404 });
    }) as typeof fetch;

    try {
      const handler = mock(() => ({
        content: [{ type: "text" as const, text: "result" }],
      }));

      const wrappedTool = createMcpPaymentWrapper(
        "test_tool",
        {
          accepts: TEST_REQUIREMENT,
          facilitatorUrl: "https://facilitator.test",
        },
        handler,
      );

      const payload = createTestPayload(TEST_REQUIREMENT);
      const meta = { [META_PAYMENT_KEY]: payload };
      const result = await wrappedTool({}, meta);

      expect(result.isError).toBe(true);
      expect(result.structuredContent?.x402Version).toBe(2);
      expect(handler).not.toHaveBeenCalled();
    } finally {
      global.fetch = originalFetch;
    }
  });

  test("[unit|mcp] - [createMcpPaymentWrapper|error] - returns error when settlement fails", async () => {
    const originalFetch = global.fetch;
    global.fetch = mock(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/verify")) {
        return new Response(
          JSON.stringify({ isValid: true, payer: TEST_PAYER }),
          { status: 200 },
        );
      }
      if (url.endsWith("/settle")) {
        return new Response(
          JSON.stringify({
            success: false,
            errorReason: "insufficient_funds",
            transaction: "",
            network: "eip155:84532",
          }),
          { status: 200 },
        );
      }
      return new Response("Not Found", { status: 404 });
    }) as typeof fetch;

    try {
      const handler = mock(
        (_args: Record<string, unknown>, _ctx: { payment: McpPaymentContext }) => ({
          content: [{ type: "text" as const, text: "Tool executed" }],
        }),
      );

      const wrappedTool = createMcpPaymentWrapper(
        "test_tool",
        {
          accepts: TEST_REQUIREMENT,
          facilitatorUrl: "https://facilitator.test",
        },
        handler,
      );

      const payload = createTestPayload(TEST_REQUIREMENT);
      const meta = { [META_PAYMENT_KEY]: payload };
      const result = await wrappedTool({}, meta);

      expect(result.isError).toBe(true);
      expect(result.structuredContent?.x402Version).toBe(2);

      const parsed = JSON.parse(result.content[0]!.text);
      expect(parsed.error).toContain("Payment settlement failed");

      expect(handler).toHaveBeenCalledTimes(1);
    } finally {
      global.fetch = originalFetch;
    }
  });

  test("[unit|mcp] - [createMcpPaymentWrapper|hooks] - calls onVerify and onSettle hooks", async () => {
    const originalFetch = global.fetch;
    global.fetch = mock(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/verify")) {
        return new Response(
          JSON.stringify({ isValid: true, payer: TEST_PAYER }),
          { status: 200 },
        );
      }
      if (url.endsWith("/settle")) {
        return new Response(
          JSON.stringify({
            success: true,
            transaction: "0xtx456",
            network: "eip155:84532",
            payer: TEST_PAYER,
          }),
          { status: 200 },
        );
      }
      return new Response("Not Found", { status: 404 });
    }) as typeof fetch;

    try {
      const onVerify = mock(() => {});
      const onSettle = mock(() => {});

      const handler = mock(() => ({
        content: [{ type: "text" as const, text: "Done" }],
      }));

      const wrappedTool = createMcpPaymentWrapper(
        "test_tool",
        {
          accepts: TEST_REQUIREMENT,
          facilitatorUrl: "https://facilitator.test",
        },
        handler,
        { onVerify, onSettle },
      );

      const payload = createTestPayload(TEST_REQUIREMENT);
      const meta = { [META_PAYMENT_KEY]: payload };
      await wrappedTool({}, meta);

      expect(onVerify).toHaveBeenCalledTimes(1);
      expect(onSettle).toHaveBeenCalledTimes(1);
    } finally {
      global.fetch = originalFetch;
    }
  });

  test("[unit|mcp] - [createMcpPaymentWrapper|error] - does not settle when handler returns error", async () => {
    const originalFetch = global.fetch;
    const settleCalls: string[] = [];
    global.fetch = mock(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/verify")) {
        return new Response(
          JSON.stringify({ isValid: true, payer: TEST_PAYER }),
          { status: 200 },
        );
      }
      if (url.endsWith("/settle")) {
        settleCalls.push(url);
        return new Response(
          JSON.stringify({
            success: true,
            transaction: "0xtx789",
            network: "eip155:84532",
          }),
          { status: 200 },
        );
      }
      return new Response("Not Found", { status: 404 });
    }) as typeof fetch;

    try {
      const handler = mock(() => ({
        content: [{ type: "text" as const, text: "Handler error" }],
        isError: true,
      }));

      const wrappedTool = createMcpPaymentWrapper(
        "test_tool",
        {
          accepts: TEST_REQUIREMENT,
          facilitatorUrl: "https://facilitator.test",
        },
        handler,
      );

      const payload = createTestPayload(TEST_REQUIREMENT);
      const meta = { [META_PAYMENT_KEY]: payload };
      const result = await wrappedTool({}, meta);

      expect(result.isError).toBe(true);
      expect(result.content[0]!.text).toBe("Handler error");
      expect(settleCalls).toHaveLength(0);
    } finally {
      global.fetch = originalFetch;
    }
  });

  test("[unit|mcp] - [createMcpPaymentWrapper|success] - uses custom resource info", async () => {
    const handler = mock(() => ({
      content: [{ type: "text" as const, text: "result" }],
    }));

    const customResource = {
      url: "mcp://tool/custom",
      description: "Custom tool description",
      mimeType: "text/plain",
    };

    const wrappedTool = createMcpPaymentWrapper(
      "test_tool",
      {
        accepts: TEST_REQUIREMENT,
        facilitatorUrl: "https://facilitator.test",
        resource: customResource,
      },
      handler,
    );

    const result = await wrappedTool({}, undefined);

    expect(result.isError).toBe(true);
    const parsed = JSON.parse(result.content[0]!.text);
    expect(parsed.resource.url).toBe("mcp://tool/custom");
    expect(parsed.resource.description).toBe("Custom tool description");
  });

  test("[unit|mcp] - [createMcpPaymentWrapper|success] - accepts array of requirements", async () => {
    const handler = mock(() => ({
      content: [{ type: "text" as const, text: "result" }],
    }));

    const secondRequirement: PaymentRequirementsV2 = {
      ...TEST_REQUIREMENT,
      network: "eip155:1",
    };

    const wrappedTool = createMcpPaymentWrapper(
      "test_tool",
      {
        accepts: [TEST_REQUIREMENT, secondRequirement],
        facilitatorUrl: "https://facilitator.test",
      },
      handler,
    );

    const result = await wrappedTool({}, undefined);
    const parsed = JSON.parse(result.content[0]!.text);
    expect(parsed.accepts).toHaveLength(2);
  });
});
