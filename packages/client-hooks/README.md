# @armory-sh/client-hooks

Optional preset hook package for Armory x402 clients.

## Installation

```bash
bun add @armory-sh/client-hooks
```

## Included Hooks

- `PaymentPreference.chain(preferredChains)`
- `PaymentPreference.token(preferredTokens)`
- `PaymentPreference.cheapest()`
- `Logger.console(options?)`
- `combineHooks(...hooks)` (optional utility)

## Example

```typescript
import { createX402Client } from '@armory-sh/client-viem'
import { PaymentPreference, Logger } from '@armory-sh/client-hooks'

const client = createX402Client({
  wallet: { type: 'account', account },
  hooks: [
    PaymentPreference.chain(['base', 'polygon', 'skale']),
    PaymentPreference.token(['USDT', 'USDC', 'WBTC']),
    PaymentPreference.cheapest(),
    Logger.console(),
  ],
})
```

Selection narrows progressively across hooks in order:
- chain preference narrows to matching networks
- token preference narrows within the selected chain when available
- cheapest refines within the selected network and asset

If no hook selects a requirement, clients fall back to the first compatible `accepts[]` option from `PAYMENT-REQUIRED`.
