# @armory/middleware

HTTP middleware for X-402 payment protocol. Express, Hono, Bun, Elysia.

---

## Package Commands

```bash
# From /packages/middleware
bun run build    # Build dist/
bun run test     # Run tests
```

---

## Key Exports

### Core Functions

```typescript
import {
  createPaymentRequirements,
  verifyWithFacilitator,
  settleWithFacilitator,
  createPaymentRequiredHeaders,
  createSettlementHeaders,
} from "@armory/middleware"
```

### Types

```typescript
import type {
  FacilitatorConfig,
  MiddlewareConfig,
  SettlementMode,
  PayToAddress,
  HttpRequest,
  HttpResponse,
  FacilitatorVerifyResult,
  FacilitatorSettleResult,
} from "@armory/middleware"
```

### Express Middleware

```typescript
import {
  paymentMiddleware,
  type AugmentedRequest,
  type PaymentMiddlewareConfig,
} from "@armory/middleware"
```

### Hono Middleware

```typescript
import {
  honoPaymentMiddleware,
  type PaymentMiddlewareConfig as HonoPaymentMiddlewareConfig,
  type PaymentInfo,
  type PaymentVariables,
} from "@armory/middleware"
```

### Bun Middleware

```typescript
import {
  createBunMiddleware,
  type BunMiddleware,
  type BunMiddlewareConfig,
} from "@armory/middleware"
```

### Elysia Middleware

```typescript
import {
  elysiaPaymentMiddleware,
  type PaymentMiddlewareConfig as ElysiaPaymentMiddlewareConfig,
  type PaymentInfo as ElysiaPaymentInfo,
  type PaymentContext,
} from "@armory/middleware"
```

---

## Usage Patterns

### Express

```typescript
import express from 'express'
import { paymentMiddleware } from '@armory/middleware'
import { TOKENS } from '@armory/tokens'

const app = express()

app.use(paymentMiddleware({
  facilitatorUrl: 'http://localhost:3000',
  settlementMode: 'async',
  token: TOKENS.USDC_BASE,
}))

app.get('/protected', (req, res) => {
  // req.payment is available
  const { version, amount, fromAddress } = req.payment
  res.json({ data: 'protected resource' })
})

app.listen(3000)
```

### Hono

```typescript
import { Hono } from 'hono'
import { honoPaymentMiddleware } from '@armory/middleware'
import { TOKENS } from '@armory/tokens'

const app = new Hono()

app.use('*', honoPaymentMiddleware({
  facilitatorUrl: 'http://localhost:3000',
  settlementMode: 'async',
  token: TOKENS.USDC_BASE,
}))

app.get('/protected', (c) => {
  const payment = c.get('payment')
  return c.json({ data: 'protected resource' })
})
```

### Bun

```typescript
import { createBunMiddleware } from '@armory/middleware'
import { TOKENS } from '@armory/tokens'

const middleware = createBunMiddleware({
  token: TOKENS.USDC_BASE,
  settlementMode: 'verify',
  facilitator: {
    url: 'http://localhost:3000'
  }
})

Bun.serve({
  port: 3000,
  fetch: (req) => middleware(req)
})
```

### Elysia

```typescript
import { Elysia } from 'elysia'
import { elysiaPaymentMiddleware } from '@armory/middleware'
import { TOKENS } from '@armory/tokens'

const app = new Elysia()
  .use(elysiaPaymentMiddleware({
    facilitatorUrl: 'http://localhost:3000',
    settlementMode: 'async',
    token: TOKENS.USDC_BASE,
  }))
  .listen(3000)
```

---

## Configuration

### Settlement Modes

- **`sync`**: Wait for on-chain settlement before responding
- **`async`**: Return immediately, settle in background
- **`verify`**: Only verify, don't settle

### Facilitator Integration

Middleware calls facilitator endpoints:
- `POST /verify` - Verify payment signature and details
- `POST /settle` - Execute on-chain settlement

---

## File Structure

```
src/
├── types.ts       # Shared types
├── core.ts        # Core functions (requirements, headers)
├── express.ts     # Express middleware
├── hono.ts        # Hono middleware
├── bun.ts         # Bun middleware
├── elysia.ts      # Elysia middleware
└── index.ts       # Main exports
```

---

## Dependencies

- **@armory/base**: Protocol types and configs
- **hono** (peer): For Hono middleware
- **express** (peer): For Express middleware
- **elysia** (peer): For Elysia middleware

---

## Implementation Notes

- **Version detection**: Auto-detects v1/v2 from headers
- **Header parsing**: Decodes Base64URL payment payloads
- **Facilitator client**: HTTP calls to settlement server
- **Request augmentation**: Adds `payment` object to request context

---

## Token Object Usage

### Using Pre-configured Tokens

```typescript
import { TOKENS } from "@armory/tokens";
import { paymentMiddleware } from "@armory/middleware";

app.use(paymentMiddleware({
  facilitatorUrl: 'http://localhost:3000',
  settlementMode: 'async',
  token: TOKENS.USDC_BASE, // Use token object (recommended)
}));

// Legacy approach (still supported)
app.use(paymentMiddleware({
  facilitatorUrl: 'http://localhost:3000',
  settlementMode: 'async',
  payToAddress: '0x...', // Individual fields
  contractAddress: '0x...',
  network: 'base',
}));
```

### Registering Custom Tokens

```typescript
import { registerToken } from "@armory/base";

registerToken({
  symbol: "MYTOKEN",
  name: "My Custom Token",
  version: "1",
  contractAddress: "0x...",
  chainId: 8453,
  decimals: 18,
});
```
