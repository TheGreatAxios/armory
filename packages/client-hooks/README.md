# @armory-sh/client-hooks

Optional preset hook package for Armory x402 clients.

## Installation

```bash
bun add @armory-sh/client-hooks
```

## API Reference

### PaymentPreference

Chain and token selection hooks:

```typescript
import {
  PaymentPreference,

  // Types
  type ClientHook,
} from '@armory-sh/client-hooks';
```

**Methods:**

- `PaymentPreference.chain(preferredChains)` - Prefer specific networks
- `PaymentPreference.token(preferredTokens)` - Prefer specific tokens
- `PaymentPreference.cheapest()` - Select lowest amount option

### Logger

Payment event logging:

```typescript
import {
  Logger,
  type LoggerOptions,
} from '@armory-sh/client-hooks';
```

**Methods:**

- `Logger.console(options?)` - Log to console

**Options:**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `prefix` | `string` | `"[x402]"` | Log prefix |
| `enabled` | `boolean` | `true` | Enable logging |

### Utilities

```typescript
import {
  combineHooks,
} from '@armory-sh/client-hooks';
```

**Methods:**

- `combineHooks(...hooks)` - Combine multiple hook arrays

### Types

```typescript
import type {
  PaymentRequiredContext,
  PaymentPayloadContext,
  ClientHookErrorContext,
  ClientHook,
} from '@armory-sh/client-hooks';
```

---

## Example

```typescript
import { createX402Client } from '@armory-sh/client-viem'
import { PaymentPreference, Logger } from '@armory-sh/client-hooks'

const client = createX402Client({
  wallet: { type: 'account', account },
  hooks: [
    PaymentPreference.chain(['base', 'ethereum', 'skale-base']),
    PaymentPreference.token(['USDT', 'USDC', 'WBTC']),
    PaymentPreference.cheapest(),
    Logger.console(),
  ],
})
```

## Selection Behavior

- Hook selection narrows progressively in array order
- Chain preference runs first, then token preference narrows within selected chain
- Cheapest refines within the selected network and asset
- If no hook selects, clients fall back to the first compatible `accepts[]` option from `PAYMENT-REQUIRED`

## Supported Networks

| Key | Chain ID | Name |
|-----|----------|------|
| `ethereum` | 1 | Ethereum Mainnet |
| `base` | 8453 | Base Mainnet |
| `base-sepolia` | 84532 | Base Sepolia |
| `skale-base` | 1187947933 | SKALE Base |
| `skale-base-sepolia` | 324705682 | SKALE Base Sepolia |
| `ethereum-sepolia` | 11155111 | Ethereum Sepolia |
