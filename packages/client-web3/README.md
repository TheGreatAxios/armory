# @armory-sh/client-web3

Web3.js client for creating and signing Armory payments.

## Install

```bash
bun add @armory-sh/client-web3
```

## Use

```typescript
import { Web3 } from 'web3'
import { createArmoryPayment } from '@armory-sh/client-web3'

const web3 = new Web3('https://mainnet.base.org')

const payment = await createArmoryPayment(web3, {
  to: '0x...',
  amount: 1000000n,
  chainId: 'eip155:8453',
  assetId: 'eip155:8453/erc20:0x...'
})
```

---

MIT License | Sawyer Cutler 2026 | Provided "AS IS" without warranty
