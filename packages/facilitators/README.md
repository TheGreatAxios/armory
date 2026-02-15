# @armory-sh/facilitators

> **⚠️ DEPRECATED** - This package is deprecated and will be removed in v3.0.0

## Migration

This package has been split into more focused packages:

| Old Functionality | New Package |
|-------------------|-------------|
| x402 Protocol Types | `@armory-sh/base` |
| Server Middleware | `@armory-sh/middleware-express`<br>`@armory-sh/middleware-hono`<br>`@armory-sh/middleware-elysia`<br>`@armory-sh/middleware-bun` |
| Client Libraries | `@armory-sh/client-viem`<br>`@armory-sh/client-ethers`<br>`@armory-sh/client-web3` |

### For x402 Protocol Types

```typescript
import {
  PaymentPayload,
  PaymentRequirements,
  SettlementResponse,
  encodePayment,
  decodePayment,
} from "@armory-sh/base";
```

### For Server Middleware

```typescript
// Express
import { paymentMiddleware } from "@armory-sh/middleware-express";

// Hono
import { paymentMiddleware } from "@armory-sh/middleware-hono";

// Elysia
import { paymentMiddleware } from "@armory-sh/middleware-elysia";

// Bun
import { paymentMiddleware } from "@armory-sh/middleware-bun";
```

### For Client Libraries

```typescript
// Viem
import { createX402Client } from "@armory-sh/client-viem";

// Ethers
import { createX402Client } from "@armory-sh/client-ethers";

// Web3.js
import { createX402Client } from "@armory-sh/client-web3";
```
