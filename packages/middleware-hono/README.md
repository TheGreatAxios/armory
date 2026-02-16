# @armory-sh/middleware-hono

x402 payment middleware for Hono applications.

## Installation

```bash
bun add @armory-sh/middleware-hono
```

## Features

- Simple payment middleware for Hono
- Route-aware payment configuration
- Multi-network, multi-token support
- Per-route facilitator configuration
- Full TypeScript support

## Basic Usage

```typescript
import { Hono } from "hono";
import { paymentMiddleware } from "@armory-sh/middleware-hono";

const app = new Hono();

app.use("/*", paymentMiddleware({
  payTo: "0xYourAddress...",
  chain: "base",
  token: "usdc",
  amount: "1.0",
}));

app.get("/api/data", (c) => {
  const payment = c.get("payment");
  return c.json({
    data: "protected data",
    payerAddress: payment?.payload?.authorization?.from,
  });
});
```

## Route-Aware Middleware

Configure different payment requirements for different routes:

```typescript
import { routeAwarePaymentMiddleware } from "@armory-sh/middleware-hono";

const app = new Hono();

// Single route with wildcard
app.use("/api/premium/*", routeAwarePaymentMiddleware({
  routes: ["/api/premium/*"],
  payTo: "0xYourAddress...",
  amount: "$5.00",
  network: "base"
}));

// Multiple routes with per-route configuration
app.use("/api/*", routeAwarePaymentMiddleware({
  routes: ["/api/basic", "/api/premium/*"],
  payTo: "0xYourAddress...",
  amount: "$1.00",  // Default amount
  network: "base",
  perRoute: {
    "/api/premium/*": {
      amount: "$5.00",  // Override for premium routes
      network: "ethereum",
    }
  }
}));
```

## Configuration Options

### PaymentConfig

```typescript
interface PaymentConfig {
  payTo: string;                    // Payment recipient address
  chain?: string | number;          // Network (name or chain ID)
  chains?: Array<string | number>;  // Multiple networks
  token?: string;                   // Token symbol
  tokens?: string[];                // Multiple tokens
  amount?: string;                  // Amount (default: "1.0")
  maxTimeoutSeconds?: number;       // Payment timeout (default: 300)

  // Per-chain configuration
  payToByChain?: Record<string, string>;
  facilitatorUrlByChain?: Record<string, string>;

  // Per-token-per-chain configuration
  payToByToken?: Record<string, Record<string, string>>;
  facilitatorUrlByToken?: Record<string, Record<string, string>>;
}
```

### RouteAwarePaymentConfig

```typescript
interface RouteAwarePaymentConfig extends PaymentConfig {
  route?: string;    // Single exact route (no wildcards)
  routes?: string[];  // Multiple routes (allows wildcards)
  perRoute?: Record<string, Partial<PaymentConfig>>;
}
```

## Payment Context

The middleware adds payment information to the Hono context:

```typescript
app.get("/api/data", (c) => {
  const payment = c.get("payment");
  // payment.payload: PaymentPayloadV2
  // payment.verified: boolean
  // payment.route: string (only for route-aware middleware)
});
```

## Input Formats

**Networks** - Use any format:
```typescript
'base'              // name
8453                // chain ID
'eip155:8453'       // CAIP-2
```

**Tokens** - Use any format:
```typescript
'usdc'              // symbol (case-insensitive)
'0x8335...'         // EVM address
'eip155:8453/erc20:0x8335...'  // CAIP Asset ID
```

## Route Pattern Matching

- **Exact**: `/api/users` - matches only `/api/users`
- **Wildcard**: `/api/*` - matches `/api/users`, `/api/posts/123`
- **Parameterized**: `/api/users/:id` - matches `/api/users/123`

Priority order: Exact matches > Parameterized routes > Wildcard routes

## Examples

### Multi-Network Support

```typescript
app.use("/*", paymentMiddleware({
  payTo: "0xYourAddress...",
  chains: ["base", "ethereum", "skale-base"],
  tokens: ["usdc", "eurc"],
  amount: "1.0"
}));
```

### Per-Chain Configuration

```typescript
app.use("/*", paymentMiddleware({
  payTo: "0xDefaultAddress...",
  payToByChain: {
    base: "0xBaseAddress...",
    ethereum: "0xEthAddress...",
  },
  chain: "base",
  token: "usdc"
}));
```

### Route-Specific Pricing

```typescript
app.use("/api/*", routeAwarePaymentMiddleware({
  routes: ["/api/basic", "/api/pro", "/api/enterprise"],
  payTo: "0xYourAddress...",
  amount: "$1.00",
  network: "base",
  perRoute: {
    "/api/pro": {
      amount: "$5.00",
    },
    "/api/enterprise": {
      amount: "$50.00",
      network: "ethereum",
    }
  }
}));
```

## API

### `paymentMiddleware(config)`

Creates a basic payment middleware for Hono.

**Parameters:**
- `config`: Payment configuration

**Returns:** Hono middleware function

### `createPaymentRequirements(config)`

Creates payment requirements from configuration (for advanced use).

**Parameters:**
- `config`: Payment configuration

**Returns:** Object with `requirements` array and optional `error`

### `routeAwarePaymentMiddleware(config)`

Creates a route-aware payment middleware for Hono.

**Parameters:**
- `config`: Route-aware payment configuration

**Returns:** Hono middleware function
