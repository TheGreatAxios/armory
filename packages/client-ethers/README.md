# @armory/client-ethers

Ethers v6 client for creating and signing Armory payments.

## Install

```bash
bun add @armory/client-ethers
```

## Use

```typescript
import { ethers } from 'ethers'
import { createArmoryPayment } from '@armory/client-ethers'

const provider = new ethers.JsonRpcProvider('https://mainnet.base.org')
const signer = await provider.getSigner()

const payment = await createArmoryPayment(signer, {
  to: '0x...',
  amount: 1000000n,
  chainId: 'eip155:8453',
  assetId: 'eip155:8453/erc20:0x...'
})
```

---

MIT License | Sawyer Cutler 2026 | Provided "AS IS" without warranty
