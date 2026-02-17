# @armory-sh/client-web3

Armory x402 SDK — Payment client for Web3.js. Make payments from any Web3.js wallet. 100% compatible with Coinbase x402 SDKs.

[Documentation](https://armory.sh) | [License](LICENSE)

## Installation

```bash
bun add @armory-sh/client-web3
bun add @armory-sh/client-hooks # optional preference/logger hooks
```

## Why Armory?

Armory enables HTTP API payments via EIP-3009 `transferWithAuthorization`. Let your users pay with USDC directly from their wallet—no credit cards, no middlemen, no gas for payers.

## Key Exports

```typescript
import {
  // Client Creation
  createX402Client,
  createX402Transport,

  // Protocol
  detectX402Version,
  parsePaymentRequired,

  // Signing
  signPayment,
  signEIP3009,
  recoverEIP3009Signer,

  // Types
  type Web3X402Client,
  type X402ClientConfig,
  type X402TransportConfig,
  type SignPaymentOptions,

  // Errors
  X402ClientError,
  SigningError,
  PaymentError,
} from '@armory-sh/client-web3';
```

## Quick Start

```typescript
import { createX402Client } from '@armory-sh/client-web3'
import { Web3 } from 'web3'

const web3 = new Web3('https://mainnet.base.org')
const account = web3.eth.accounts.create()

const client = createX402Client({ account })

// Auto-handles 402 Payment Required responses
const response = await client.fetch('https://api.example.com/protected')
const data = await response.json()
```

## Hook Pipeline

```typescript
import { createX402Client } from '@armory-sh/client-web3'
import { PaymentPreference, Logger } from '@armory-sh/client-hooks'

const client = createX402Client({
  account,
  hooks: [
    PaymentPreference.chain(['base', 'polygon', 'skale']),
    PaymentPreference.token(['USDT', 'USDC', 'WBTC']),
    PaymentPreference.cheapest(),
    Logger.console(),
  ],
})
```

`parsePaymentRequired` returns `accepts[]` (x402 v2 challenge options). Clients select from this list.

## Features

- **Auto 402 Handling**: Automatically intercepts and pays for 402 responses
- **EIP-3009 Signing**: Full support for EIP-3009 TransferWithAuthorization
- **Multi-Network**: Ethereum, Base, SKALE support
- **Multi-Token**: USDC, EURC, USDT, WBTC, WETH, SKL
- **Extension Support**: SIWX, Payment ID, custom extensions
- **Transport Wrapper**: Create fetch function with payment handling
- **Web3.js Compatible**: Works with Web3.js v4+

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
