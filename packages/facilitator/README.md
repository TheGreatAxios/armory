# @armory/facilitator

Payment verification and settlement server.

## Install

```bash
bun add @armory/facilitator
```

## Use

```typescript
import { FacilitatorServer } from '@armory/facilitator'

const server = new FacilitatorServer({
  privateKey: process.env.PRIVATE_KEY,
  rpcUrls: {
    8453: 'https://mainnet.base.org'
  }
})

await server.start()
```

---

MIT License | Sawyer Cutler 2026 | Provided "AS IS" without warranty
