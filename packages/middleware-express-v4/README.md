# @armory-sh/middleware-express-v4

x402 payment middleware for Express v4 applications.

## Installation

```bash
bun add @armory-sh/middleware-express-v4
```

## Features

- Simple payment middleware for Express v4
- Route-aware payment configuration
- Multi-network, multi-token support
- Full TypeScript support

## Basic Usage

```typescript
import express from "express";
import { paymentMiddleware } from "@armory-sh/middleware-express-v4";

const app = express();

const requirements = {
  scheme: "exact" as const,
  network: "eip155:8453",
  amount: "1000000",
  asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as `0x${string}`,
  payTo: "0xYourAddress..." as `0x${string}`,
  maxTimeoutSeconds: 300,
  extra: {},
};

app.use(paymentMiddleware({ requirements }));

app.get("/api/data", (req, res) => {
  const payment = (req as AugmentedRequest).payment;
  res.json({
    data: "protected data",
    payerAddress: payment?.payerAddress,
  });
});
```

## Route-Aware Middleware

```typescript
import { routeAwarePaymentMiddleware } from "@armory-sh/middleware-express-v4";
import type { PaymentRequirementsV2 } from "@armory-sh/base";

const premiumRequirements: PaymentRequirementsV2 = {
  scheme: "exact",
  network: "eip155:8453",
  amount: "5000000",
  asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as `0x${string}`,
  payTo: "0xYourAddress..." as `0x${string}`,
  maxTimeoutSeconds: 300,
  extra: {},
};

app.use("/api/premium", routeAwarePaymentMiddleware({
  "/api/premium": { requirements: premiumRequirements },
  "/api/basic": { requirements: basicRequirements },
}));
```

## Express v4 vs v5

This package is specifically for Express v4. For Express v5, use `@armory-sh/middleware-express`.

## API

### `paymentMiddleware(config)`

Creates a payment middleware for Express v4.

### `routeAwarePaymentMiddleware(perRouteConfig)`

Creates a route-aware payment middleware for Express v4. Takes a record mapping route patterns to payment configuration entries.

---

MIT License | Sawyer Cutler 2026 | Provided "AS IS" without warranty
