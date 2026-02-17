# @armory-sh/client-viem

Armory x402 SDK — Payment client for viem wallets. Make payments from any viem-based wallet. 100% compatible with Coinbase x402 SDKs.

[Documentation](https://armory.sh) | [License](LICENSE)

## Installation

```bash
bun add @armory-sh/client-viem
```

## Why Armory?

Armory enables HTTP API payments via EIP-3009 `transferWithAuthorization`. Let your users pay with USDC directly from their wallet—no credit cards, no middlemen, no gas for payers.

## Key Exports

```typescript
import {
  // Client Creation
  createX402Client,
  createX402Transport,
  createArmory,

  // Simple API
  armoryPay,
  armoryGet,
  armoryPost,
  armoryPut,
  armoryDelete,
  armoryPatch,
  getWalletAddress,
  validateNetwork,
  validateToken,
  getNetworks,
  getTokens,
  normalizeWallet,

  // Protocol
  detectX402Version,
  parsePaymentRequired,

  // Extensions
  parseExtensions,
  extractExtension,
  createSIWxProof,
  addExtensionsToPayload,

  // Hooks
  executeHooks,
  mergeExtensions,

  // Types
  type X402Client,
  type X402ClientConfig,
  type X402Wallet,
  type X402ProtocolVersion,
  type Token,
  type PaymentResult,
  type X402TransportConfig,
  type SimpleWalletInput,
  type NormalizedWallet,
  type NetworkId,
  type TokenId,
  type ArmoryPaymentResult,
  type FacilitatorConfig,

  // Errors
  X402ClientError,
  SigningError,
  PaymentError,
} from '@armory-sh/client-viem';
```

## Quick Start

### Using armoryPay (Simplest)

```typescript
import { armoryPay } from '@armory-sh/client-viem'
import { privateKeyToAccount } from 'viem/accounts'

const account = privateKeyToAccount('0x...')

const result = await armoryPay(
  { account },
  'https://api.example.com/data',
  'base',
  'usdc'
)

if (result.success) {
  console.log(result.data)
} else {
  console.error(result.code, result.message)
}
```

### Using createX402Client

```typescript
import { createX402Client } from '@armory-sh/client-viem'
import { privateKeyToAccount } from 'viem/accounts'

const account = privateKeyToAccount('0x...')

const client = createX402Client({
  wallet: { type: 'account', account }
})

// Auto-handles 402 Payment Required responses
const response = await client.fetch('https://api.example.com/protected')
const data = await response.json()
```

### With Custom Amount

```typescript
const result = await armoryPay(
  { account },
  'https://api.example.com/premium',
  'base',
  'usdc',
  { amount: '5.0' }
)
```

### With Hook Pipeline

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

const response = await client.fetch('https://api.example.com/protected')
```

### Configuration Options

```typescript
const client = createX402Client({
  wallet: { type: 'account', account },

  // Protocol version (default: 2)
  version: 2,

  // Authorization expiry in seconds (default: 3600)
  defaultExpiry: 7200,

  // Custom nonce generator - MUST return bytes32 hex string
  nonceGenerator: () => `0x${Date.now().toString(16).padStart(64, '0')}` as `0x${string}`,

  // Enable debug logging
  debug: true,
})
```

## Features

- **Auto 402 Handling**: Automatically intercepts and pays for 402 responses
- **EIP-3009 Signing**: Full support for EIP-3009 TransferWithAuthorization
- **Multi-Network**: Ethereum, Base, SKALE support
- **Multi-Token**: USDC, EURC, USDT, WBTC, WETH, SKL
- **Extension Support**: SIWX, Payment ID, custom extensions
- **Transport Wrapper**: Create fetch function with payment handling
- **Viem Compatible**: Works with any viem Account or WalletClient

## Supported Networks

| Network | Chain ID |
|---------|----------|
| Ethereum | 1 |
| Base | 8453 |
| Base Sepolia | 84532 |
| SKALE Base | 1187947933 |
| SKALE Base Sepolia | 324705682 |

## License

MIT © [Sawyer Cutler](https://github.com/TheGreatAxios/armory)
