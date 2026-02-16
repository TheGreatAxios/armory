# @armory-sh/middleware-elysia

Armory x402 SDK — Payment middleware for Elysia. Accept x402 payments from any client in your Elysia app. 100% compatible with Coinbase x402 SDKs.

[Documentation](https://armory.sh) | [License](LICENSE)

## Installation

```bash
bun add @armory-sh/middleware-elysia
```

## Why Armory?

Armory enables HTTP API payments via EIP-3009 `transferWithAuthorization`. Accept payments from any x402-compatible client—Coinbase SDK, Armory SDK, or your own implementation.

## Key Exports

```typescript
import {
  paymentMiddleware,
  routeAwarePaymentMiddleware,
  type PaymentConfig,
  type RouteAwarePaymentConfig,
} from '@armory-sh/middleware-elysia';
```

## Quick Start

```typescript
import { Elysia } from 'elysia'
import { paymentMiddleware } from '@armory-sh/middleware-elysia'

const app = new Elysia()
  .use(paymentMiddleware({
    requirements: {
      scheme: 'exact',
      network: 'eip155:8453',
      amount: '1000000',
      asset: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
      payTo: '0xYourAddress...',
      maxTimeoutSeconds: 300,
      extra: {}
    }
  }))
  .get('/api/data', ({ payment }) => ({
    payerAddress: payment?.payerAddress
  }))
  .listen(3000)
```

## Features

- **x402 Compatible**: Accept payments from any x402 client
- **Route-Aware**: Different pricing for different routes
- **Multi-Network**: Ethereum, Base, SKALE support
- **Multi-Token**: USDC, EURC, USDT, WBTC, WETH, SKL

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
