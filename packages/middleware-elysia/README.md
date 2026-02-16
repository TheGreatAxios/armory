# @armory-sh/middleware-elysia

x402 payment middleware for Elysia applications.

## Installation

```bash
bun add @armory-sh/middleware-elysia
```

## Features

- Simple payment plugin for Elysia
- Route-aware payment configuration
- Multi-network, multi-token support
- Full TypeScript support

## Basic Usage

```typescript
import { Elysia } from "elysia";
import { paymentMiddleware } from "@armory-sh/middleware-elysia";

const requirements = {
  scheme: "exact" as const,
  network: "eip155:8453",
  amount: "1000000",
  asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as `0x${string}`,
  payTo: "0xYourAddress..." as `0x${string}`,
  maxTimeoutSeconds: 300,
  extra: {},
};

const app = new Elysia()
  .use(paymentMiddleware({ requirements }))
  .get("/api/data", ({ payment }) => {
    return {
      data: "protected data",
      payerAddress: payment?.payerAddress,
    };
  })
  .listen(3000);
```

## Route-Aware Middleware

```typescript
import { routeAwarePaymentMiddleware } from "@armory-sh/middleware-elysia";

const premiumRequirements = {
  scheme: "exact" as const,
  network: "eip155:8453",
  amount: "5000000",
  asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as `0x${string}`,
  payTo: "0xYourAddress..." as `0x${string}`,
  maxTimeoutSeconds: 300,
  extra: {},
};

const app = new Elysia()
  .use(routeAwarePaymentMiddleware({
    "/api/premium": { requirements: premiumRequirements },
    "/api/basic": { requirements: basicRequirements },
  }))
  .listen(3000);
```

## API

### `paymentMiddleware(config)`

Creates a payment plugin for Elysia.

### `routeAwarePaymentMiddleware(perRouteConfig)`

Creates a route-aware payment plugin for Elysia. Takes a record mapping route patterns to payment configuration entries.
