# Armory

TypeScript libraries for the X-402 payment protocol (EIP-3009). Enable server-to-client payments via HTTP headers with flexible, developer-friendly APIs.

## Features

- **Simple 1-line API** - `armoryPay(wallet, url, "base", "usdc")`
- **Flexible Inputs** - Use names, chain IDs, CAIP formats, or addresses
- **Comprehensive Validation** - Clear errors before you make requests
- **Multi-Chain Support** - Base, Ethereum, SKALE, and more
- **Multi-Token Support** - USDC, EURC, USDT, WBTC, WETH, and custom tokens
- **Route-Based Configuration** - Per-route payment settings for complex APIs
- **Type-Safe** - Full TypeScript with strict mode

## Installation

```bash
# For clients (making payments)
bun add @armory-sh/client-viem

# For merchants (accepting payments)
bun add @armory-sh/middleware
```

## Quick Start

### For Buyers (Making Payments)

```typescript
import { armoryPay } from '@armory-sh/client-viem';
import { privateKeyToAccount } from 'viem/accounts';

const account = privateKeyToAccount('0x...');

// One line - handles everything
const result = await armoryPay(
  { account },
  'https://api.example.com/data',
  'base',    // network (name, chain ID, or CAIP-2)
  'usdc'     // token (symbol, address, or CAIP asset ID)
);

if (result.success) {
  console.log(result.data);   // API response
  console.log(result.txHash); // Settlement hash
} else {
  console.error(result.code, result.message);
}
```

### For Merchants (Accepting Payments)

```typescript
import { acceptPaymentsViaArmory } from '@armory-sh/middleware';

// Simple - single network, default USDC
app.use(acceptPaymentsViaArmory({
  payTo: '0xYourAddress...',
  amount: '1.0'
}));

// Advanced - multi-network, multi-token
app.use(acceptPaymentsViaArmory({
  payTo: '0xYourAddress...',
  amount: '1.0',
  accept: {
    networks: ['base', 'ethereum', 'skale-base'],
    tokens: ['usdc', 'eurc']
  }
}));

// Route-based - different pricing per endpoint
app.use('/api/premium/*', acceptPaymentsViaArmory({
  payTo: '0xYourAddress...',
  amount: '5.0',  // Higher price for premium routes
  route: '/api/premium/*'
}));

app.use('/api/basic/*', acceptPaymentsViaArmory({
  payTo: '0xYourAddress...',
  amount: '0.5',  // Lower price for basic routes
  route: '/api/basic/*'
}));
```

## CLI

The `armory-cli` tool helps you scaffold projects and query protocol data.

```bash
# Install globally
bun add -g armory-cli

# Create a project
armory create bun-server my-api
armory create viem-client my-client

# Query networks and tokens
armory networks              # List all networks
armory networks --mainnet    # Mainnets only
armory tokens base           # Tokens on Base

# Validate identifiers
armory validate network 8453
armory validate token usdc

# Check endpoints
armory verify https://api.example.com/data

# List extensions
armory extensions
```

### Available Templates

| Template | Description |
|----------|-------------|
| `bun-server` | Bun server with payment middleware |
| `express-server` | Express v5 server |
| `hono-server` | Hono server with extensions |
| `elysia-server` | Elysia/Bun server |
| `next-server` | Next.js middleware |
| `viem-client` | Viem x402 client |
| `ethers-client` | Ethers.js v6 client |
| `web3-client` | Web3.js client |

## All Input Formats

**Networks** - Use any format:
```typescript
'base'              // name
8453                // chain ID
'eip155:8453'       // CAIP-2
```

**Tokens** - Use any format:
```typescript
'usdc'              // symbol (case-insensitive)
'0x8335...'         // EVM address
'eip155:8453/erc20:0x8335...'  // CAIP Asset ID
```

## Documentation

- [Overview](./docs/index.mdx) - Protocol overview and architecture
- [Accept Payments](./docs/accept-payments/express.mdx) - Add payments to your API
- [Make Payments](./docs/make-payments/viem.mdx) - Pay for APIs from your app
- [Custom Tokens](./docs/advanced/custom-tokens.mdx) - Add your own tokens
- [Agent Guidelines](./AGENTS.md) - Building AI agents with Armory

## Supported Networks

| Network | Chain ID | Name |
|---------|----------|------|
| Ethereum | 1 | ethereum |
| Base | 8453 | base |
| Base Sepolia | 84532 | base-sepolia |
| SKALE Base | 1187947933 | skale-base |
| SKALE Base Sepolia | 324705682 | skale-base-sepolia |
| Ethereum Sepolia | 11155111 | ethereum-sepolia |

## Supported Tokens

Pre-configured tokens include USDC, EURC, USDT, WBTC, and WETH across all supported networks. See the [Token Registry](./docs/tokens) for the complete list.

## Packages

| Package | Description |
|---------|-------------|
| **@armory-sh/base** | Protocol types, encoding, EIP-712, network configs, validation, route matching |
| **@armory-sh/middleware** | HTTP middleware for Bun, Express, Hono, Elysia |
| **@armory-sh/middleware-express** | Express v5 middleware |
| **@armory-sh/middleware-express-v4** | Express v4 middleware |
| **@armory-sh/middleware-hono** | Hono middleware |
| **@armory-sh/middleware-bun** | Bun middleware |
| **@armory-sh/middleware-elysia** | Elysia middleware |
| **@armory-sh/middleware-next** | Next.js App Router middleware |
| **@armory-sh/client-viem** | Viem v2 payment client |
| **@armory-sh/client-ethers** | Ethers.js v6 payment client |
| **@armory-sh/client-web3** | Web3.js payment client |
| **@armory-sh/tokens** | Pre-configured token objects |
| **@armory-sh/extensions** | Protocol extensions (SIWX, payment ID) |
| **armory-cli** | Scaffold tool for x402 payment-enabled apps |

## Development

```bash
# Install dependencies
bun install

# Run tests
bun test

# Run tests for a specific package
bun test packages/base
```

## Automatic Validation

Armory validates everything upfront with clear error messages:

```typescript
// Token on wrong network
await armoryPay(wallet, url, 'ethereum', 'usdc');
// Error: TOKEN_NOT_ON_NETWORK
// "Token USDC is on chain 8453, but expected chain 1"
```

## Protocol Reference

### X-402 Protocol

- **v2**: `PAYMENT-SIGNATURE` header (CAIP-2/CAIP-10 compliant)

### EIP-3009 transferWithAuthorization

Allows off-chain authorization for USDC transfers:

```typescript
interface TransferWithAuthorization {
  from: Address
  to: Address
  value: bigint
  validAfter: bigint
  validBefore: bigint
  nonce: bigint
  signature: { v: number, r: string, s: string }
}
```

### Headers

| Payment Header | Response Header |
|---------------|-----------------|
| `PAYMENT-SIGNATURE` | `PAYMENT-RESPONSE` |

## Key Technologies

- **Runtime**: Bun
- **Language**: TypeScript (strict mode)
- **Blockchain**: Viem v2, Ethers.js v6, Web3.js
- **Protocol**: EIP-3009 (USDC transferWithAuthorization)
- **Testing**: Bun test runner

## License

MIT

## Contributing

We welcome contributions! See the [Token Registry](./docs/tokens) guide for adding new tokens, and check [AGENTS.md](./AGENTS.md) for agent development guidelines.
