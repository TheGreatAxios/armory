# @armory/middleware

Payment verification middleware for Express, Hono, Bun, Elysia.

## Install

```bash
bun add @armory/middleware
```

## Use

```typescript
// Express
import { paymentMiddleware } from '@armory/middleware'

app.use(paymentMiddleware({
  requirements: {
    to: '0x...',
    amount: 1000000n,
    expiry: Date.now() + 3600,
    chainId: 'eip155:8453',
    assetId: 'eip155:8453/erc20:0x...'
  },
  facilitatorUrl: 'https://facilitator.example.com'
}))
```

---

MIT License | Sawyer Cutler 2026 | Provided "AS IS" without warranty
