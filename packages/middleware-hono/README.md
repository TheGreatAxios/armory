# @armory-sh/middleware-hono

Armory x402 SDK — Payment middleware for Hono. Accept x402 payments from any client in your Hono app. 100% compatible with Coinbase x402 SDKs.

[Documentation](https://armory.sh) | [License](LICENSE)

## Installation

```bash
bun add @armory-sh/middleware-hono
```

## Why Armory?

Armory enables HTTP API payments via EIP-3009 `transferWithAuthorization`. Accept payments from any x402-compatible client—Coinbase SDK, Armory SDK, or your own implementation.

## Key Exports

```typescript
import {
  // Middleware
  paymentMiddleware,
  routeAwarePaymentMiddleware,

  // Requirements
  createPaymentRequirements,

  // Types
  type PaymentConfig,
  type RouteAwarePaymentConfig,
  type HonoPaymentContext,
} from '@armory-sh/middleware-hono';
```

## Quick Start

### Basic Middleware

```typescript
import { Hono } from 'hono'
import { paymentMiddleware } from '@armory-sh/middleware-hono'

const app = new Hono()

app.use('/*', paymentMiddleware({
  payTo: '0xYourAddress...',
  network: 'base',
  token: 'usdc',
  amount: '1.0'
}))

app.get('/api/data', (c) => {
  const payment = c.get('payment')
  return c.json({
    data: 'protected data',
    payerAddress: payment?.payload?.authorization?.from
  })
})

app.listen(3000)
```

### Route-Aware Middleware

```typescript
import { routeAwarePaymentMiddleware } from '@armory-sh/middleware-hono'

const app = new Hono()

// Different pricing for different routes
app.use('/api/*', routeAwarePaymentMiddleware({
  routes: ['/api/basic', '/api/premium/*'],
  payTo: '0xYourAddress...',
  amount: '$1.00',
  network: 'base',
  perRoute: {
    '/api/premium/*': {
      amount: '$5.00'
    }
  }
}))
```

### Multi-Network Support

```typescript
app.use('/*', paymentMiddleware({
  payTo: '0xYourAddress...',
  chains: ['base', 'ethereum', 'skale-base'],
  tokens: ['usdc', 'eurc'],
  amount: '1.0'
}))
```

### Per-Chain Configuration

```typescript
app.use('/*', paymentMiddleware({
  payTo: '0xDefaultAddress...',
  payToByChain: {
    base: '0xBaseAddress...',
    ethereum: '0xEthAddress...'
  },
  chain: 'base',
  token: 'usdc'
}))
```

## Configuration Options

```typescript
interface PaymentConfig {
  payTo: string                    // Payment recipient address
  chain?: string | number          // Network (name or chain ID)
  chains?: Array<string | number>  // Multiple networks
  token?: string                   // Token symbol
  tokens?: string[]                // Multiple tokens
  amount?: string                  // Amount (default: "1.0")
  maxTimeoutSeconds?: number       // Payment timeout (default: 300)

  // Per-chain configuration
  payToByChain?: Record<string, string>
  facilitatorUrlByChain?: Record<string, string>

  // Per-token-per-chain configuration
  payToByToken?: Record<string, Record<string, string>>
  facilitatorUrlByToken?: Record<string, Record<string, string>>
}

interface RouteAwarePaymentConfig extends PaymentConfig {
  route?: string                    // Single exact route
  routes?: string[]                 // Multiple routes (allows wildcards)
  perRoute?: Record<string, Partial<PaymentConfig>>
}
```

## Input Formats

**Networks** — Use any format:
```typescript
'base'              // name
8453                // chain ID
'eip155:8453'       // CAIP-2
```

**Tokens** — Use any format:
```typescript
'usdc'              // symbol (case-insensitive)
'0x8335...'         // EVM address
'eip155:8453/erc20:0x8335...'  // CAIP Asset ID
```

## Features

- **x402 Compatible**: Accept payments from any x402 client
- **Route-Aware**: Different pricing for different routes
- **Multi-Network**: Ethereum, Base, SKALE support
- **Multi-Token**: USDC, EURC, USDT, WBTC, WETH, SKL
- **Per-Chain Config**: Different addresses per network
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
