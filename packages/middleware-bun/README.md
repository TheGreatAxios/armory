# @armory-sh/middleware-bun

Armory x402 SDK — Payment middleware for Bun servers. Accept x402 payments from any client in your Bun app. 100% compatible with Coinbase x402 SDKs.

[Documentation](https://armory.sh) | [License](LICENSE)

## Installation

```bash
bun add @armory-sh/middleware-bun
```

## Why Armory?

Armory enables HTTP API payments via EIP-3009 `transferWithAuthorization`. Accept payments from any x402-compatible client—Coinbase SDK, Armory SDK, or your own implementation.

## Key Exports

```typescript
import {
  // Middleware
  createBunMiddleware,
  createRouteAwareBunMiddleware,

  // Types
  type BunMiddlewareConfig,
  type RouteAwareBunMiddlewareConfig,
  type BunPaymentContext,
} from '@armory-sh/middleware-bun';
```

## Quick Start

### Basic Middleware

```typescript
import { createBunMiddleware } from '@armory-sh/middleware-bun'

const middleware = createBunMiddleware({
  payTo: '0xYourAddress...',
  network: 'base',
  token: 'usdc',
  amount: '1.0'
})

Bun.serve({
  port: 3000,
  async fetch(req) {
    const response = await middleware(req)
    if (response) return response

    return new Response('Hello!')
  }
})
```

### Route-Aware Middleware

```typescript
import { createRouteAwareBunMiddleware } from '@armory-sh/middleware-bun'

const middleware = createRouteAwareBunMiddleware({
  routes: ['/api/premium', '/api/vip/*'],
  payTo: '0xYourAddress...',
  amount: '$5.00',
  network: 'base',
  perRoute: {
    '/api/vip/*': {
      amount: '$10.00'
    }
  }
})

Bun.serve({
  port: 3000,
  fetch: (req) => middleware(req)
})
```

## Configuration Options

```typescript
interface BunMiddlewareConfig {
  payTo: string | number           // Payment recipient
  network: string | number         // Network (name or chain ID)
  amount: string                   // Amount to charge
  facilitator?: FacilitatorConfig
  settlementMode?: 'verify' | 'settle' | 'async'
  defaultVersion?: 1 | 2
  waitForSettlement?: boolean
}

interface RouteAwareBunMiddlewareConfig extends BunMiddlewareConfig {
  route?: string
  routes?: string[]
  perRoute?: Record<string, Partial<BunMiddlewareConfig>>
}
```

## Features

- **x402 Compatible**: Accept payments from any x402 client
- **Route-Aware**: Different pricing for different routes
- **Multi-Network**: Ethereum, Base, SKALE support
- **Multi-Token**: USDC, EURC, USDT, WBTC, WETH, SKL
- **Facilitator Integration**: Optional facilitator support
- **Settlement Modes**: Verify, settle, or async settlement

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
