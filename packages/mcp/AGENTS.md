# @armory-sh/mcp - Agent Guidelines

**Package**: @armory-sh/mcp
**Purpose**: x402 payment integration for Model Context Protocol (MCP) tools
**Transport**: JSON-RPC via `_meta` field

---

## Package Purpose

This package enables MCP (Model Context Protocol) tools to require x402 payments before execution. It wraps MCP tool handlers to enforce payment verification and settlement.

---

## Architecture

### Module Structure

```
src/
├── meta.ts      # Extract/attach payment data from/to MCP `_meta` field
├── types.ts     # MCP-specific types (McpToolResult, McpPaymentContext, etc.)
├── wrapper.ts   # createMcpPaymentWrapper - main wrapper for tool handlers
└── index.ts     # Public exports
```

### Meta Keys

Payments are passed through MCP's `_meta` field using these keys:

```typescript
META_PAYMENT_KEY           = "x402/payment"
META_PAYMENT_REQUIRED_KEY  = "x402/payment-required"
META_PAYMENT_RESPONSE_KEY  = "x402/payment-response"
```

### Payment Flow

1. **Tool called without payment** → Returns `PAYMENT-REQUIRED` error with accepts[]
2. **Client re-calls with payment** → Wrapper extracts from `meta[x402/payment]`
3. **Verification** → Calls facilitator to verify signature and amount
4. **Tool execution** → Handler receives payment context
5. **Settlement** → Calls facilitator to finalize payment
6. **Response** → Settlement data attached to `result._meta[x402/payment-response]`

---

## Code Patterns

### Wrapper Usage

```typescript
// ✅ GOOD - Wrap an MCP tool handler
const protectedTool = createMcpPaymentWrapper(
  "tool-name",
  {
    accepts: {
      scheme: "exact",
      network: "eip155:8453",
      amount: "1000000",
      asset: "usdc",
      payTo: "0x...",
      maxTimeoutSeconds: 60,
    },
    facilitatorUrl: "https://...",
  },
  async (args, { payment }) => {
    // Tool logic here - payment is verified and settled
    return { content: [{ type: "text", text: "Success" }] };
  },
);

// ❌ BAD - Don't implement payment logic manually in tool handlers
```

### Using Hooks

```typescript
const toolWithHooks = createMcpPaymentWrapper(
  "tool-name",
  config,
  handler,
  {
    onVerify: async ({ payload, payerAddress, requirement }) => {
      // Track payment verification, log analytics, etc.
    },
    onSettle: async ({ payload }, settlement) => {
      // Handle successful settlement - unlock resources, etc.
    },
  },
);
```

---

## MCP-Specific Concerns

### Result Format

MCP tool results use this structure:

```typescript
interface McpToolResult {
  content: McpToolContent[];
  structuredContent?: Record<string, unknown>;
  isError?: boolean;
  _meta?: McpMeta;
}
```

The `structuredContent` field carries the `PAYMENT-REQUIRED` data for structured clients, while `content[0].text` provides JSON fallback for basic clients.

### Meta Field

The `_meta` field is the standard MCP mechanism for passing non-result data. We use it to:

1. **Receive payment** from client: `meta[x402/payment]`
2. **Return settlement** to client: `result._meta[x402/payment-response]`

### Error Handling

Payment errors should return `isError: true` with descriptive text:

```typescript
return {
  content: [{ type: "text", text: JSON.stringify({ error: "...", message: "..." }) }],
  isError: true,
};
```

---

## Testing

Follow the project-wide test naming convention:

```
[unit|mcp] - [<function>|<outcome>] - <description>
```

Example:
```typescript
describe("[unit|mcp]: extractPaymentFromMeta", () => {
  test("[unit|mcp] - [extractPaymentFromMeta|success] - extracts payment from meta", () => {
    // ...
  });
});
```

---

## Dependencies

- **@armory-sh/base** - Core x402 types, verification, and settlement functions

This package is a thin layer over `@armory-sh/base` that adapts payment flows to MCP's conventions.

---

## Important Notes

1. **No MCP SDK dependency** - This package works with plain MCP types, avoiding SDK lock-in
2. **V2 only** - Only x402 v2 is supported; no V1 compatibility
3. **Facilitator required** - All wrapped tools require a facilitator URL for verification/settlement
4. **Resource metadata** - If not provided, defaults to `mcp://tool/<tool-name>`
