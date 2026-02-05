# @armory-sh/client-viem

Viem client for creating and signing Armory payments.

## Install

```bash
bun add @armory-sh/client-viem
```

## Use

```typescript
import { createWalletClient, http } from 'viem'
import { createArmoryPayment } from '@armory-sh/client-viem'

const client = createWalletClient({ transport: http() })

const payment = await createArmoryPayment(client, {
  to: '0x...',
  amount: 1000000n,
  chainId: 'eip155:8453',
  assetId: 'eip155:8453/erc20:0x...'
})
```

---

MIT License | Sawyer Cutler 2026 | Provided "AS IS" without warranty
