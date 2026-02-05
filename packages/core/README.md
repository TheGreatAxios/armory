# @armory-sh/base

Core types and utilities for Armory payment protocol.

## Install

```bash
bun add @armory-sh/base
```

## Use

```typescript
import type { PaymentRequest, PaymentResponse } from '@armory-sh/base'
import { calculateExpiry } from '@armory-sh/base'

const payment: PaymentRequest = {
  to: '0x...',
  amount: 1000000n,
  expiry: calculateExpiry(3600),
  chainId: 'eip155:8453',
  assetId: 'eip155:8453/erc20:0x833589fcd6edb6e08f4c7c32d4f71b54bda02913'
}
```

---

MIT License | Sawyer Cutler 2026 | Provided "AS IS" without warranty
