# @armory-sh/middleware-bun

x402 payment middleware for Bun runtime applications.

## Installation

```bash
bun add @armory-sh/middleware-bun
```

## Features

- Simple payment middleware for Bun
- Route-aware payment configuration
- Multi-network, multi-token support
- Facilitator integration
- Full TypeScript support

## Basic Usage

```typescript
import { createBunMiddleware } from "@armory-sh/middleware-bun";

const middleware = createBunMiddleware({
  payTo: "0xYourAddress...",
  network: "base",
  amount: "1.0",
});

const server = Bun.serve({
  port: 3000,
  async fetch(req) {
    const response = await middleware(req);
    if (response) return response;

    return new Response("Hello!");
  },
});
```

## Route-Aware Middleware

```typescript
import { createRouteAwareBunMiddleware } from "@armory-sh/middleware-bun";

const middleware = createRouteAwareBunMiddleware({
  routes: ["/api/premium", "/api/vip/*"],
  payTo: "0xYourAddress...",
  amount: "$5.00",
  network: "base",
  perRoute: {
    "/api/vip/*": {
      amount: "$10.00",
    }
  }
});

const server = Bun.serve({
  port: 3000,
  async fetch(req) {
    return middleware(req);
  },
});
```

## Configuration

### BunMiddlewareConfig

```typescript
interface BunMiddlewareConfig {
  payTo: string | number;        // Payment recipient
  network: string | number;       // Network (name or chain ID)
  amount: string;                // Amount to charge
  facilitator?: FacilitatorConfig;
  settlementMode?: "verify" | "settle" | "async";
  defaultVersion?: 1 | 2;
  waitForSettlement?: boolean;
}

interface RouteAwareBunMiddlewareConfig extends BunMiddlewareConfig {
  route?: string;
  routes?: string[];
  perRoute?: Record<string, Partial<BunMiddlewareConfig>>;
}
```

## API

### `createBunMiddleware(config)`

Creates a payment middleware for Bun.

### `createRouteAwareBunMiddleware(config)`

Creates a route-aware payment middleware for Bun.
