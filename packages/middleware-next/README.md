# @armory-sh/middleware-next

Armory x402 SDK — Payment middleware for Next.js App Router. Accept x402 payments from any client in Next.js. 100% compatible with Coinbase x402 SDKs.

[Documentation](https://armory.sh) | [License](LICENSE)

## Installation

```bash
bun add @armory-sh/middleware-next
```

## Why Armory?

Armory enables HTTP API payments via EIP-3009 `transferWithAuthorization`. Accept payments from any x402-compatible client—Coinbase SDK, Armory SDK, or your own implementation.

## Key Exports

```typescript
import {
  paymentProxy,
  x402ResourceServer,
  type X402RouteConfig,
} from '@armory-sh/middleware-next';
```

## Quick Start

```typescript
// middleware.ts
import { paymentProxy, x402ResourceServer } from '@armory-sh/middleware-next'

const resourceServer = new x402ResourceServer(facilitatorClient)

export const proxy = paymentProxy({
  '/api/protected': {
    accepts: {
      scheme: 'exact',
      price: '1000000',
      network: 'eip155:8453',
      payTo: '0x...'
    },
    description: 'Access protected API'
  }
}, resourceServer)

export const config = { matcher: ['/api/protected/:path*'] }
```

## Per-Route Configuration

```typescript
export const proxy = paymentProxy({
  '/api/basic': {
    accepts: { scheme: 'exact', price: '1000000', network: 'eip155:8453', payTo: '0x...' },
    description: 'Basic tier'
  },
  '/api/premium': {
    accepts: { scheme: 'exact', price: '50000000', network: 'eip155:8453', payTo: '0x...' },
    description: 'Premium tier'
  }
}, resourceServer)
```

## Route Patterns

- Exact match: `/api/users`
- Wildcard: `/api/*` (matches `/api/users`, `/api/posts/123`)
- Next.js style: `/protected/:path*` (matches `/protected/foo/bar`)

## Features

- **x402 Compatible**: Accept payments from any x402 client
- **Per-Route Config**: Different pricing for different routes
- **Multi-Network**: Ethereum, Base, SKALE support
- **Multi-Token**: USDC, EURC, USDT, WBTC, WETH, SKL
- **Facilitator Integration**: Optional facilitator support

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
