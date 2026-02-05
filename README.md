# Armory

TypeScript libraries for the X-402 payment protocol (EIP-3009). Enable server-to-client payments via HTTP headers with flexible, developer-friendly APIs.

## Features

- **Simple 1-line API** - `armoryPay(wallet, url, "base", "usdc")`
- **Flexible Inputs** - Use names, chain IDs, CAIP formats, or addresses
- **Comprehensive Validation** - Clear errors before you make requests
- **Multi-Chain Support** - Base, Ethereum, SKALE, and more
- **Multi-Token Support** - USDC, EURC, USDT, WBTC, WETH, and custom tokens
- **Type-Safe** - Full TypeScript with strict mode

## Installation

```bash
# For clients (making payments)
bun add @armory/client-viem

# For merchants (accepting payments)
bun add @armory/middleware
```

## Quick Start

### For Buyers (Making Payments)

```typescript
import { armoryPay } from '@armory/client-viem';
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
import { acceptPaymentsViaArmory } from '@armory/middleware';

// Simple - single network, default USDC
app.use(acceptPaymentsViaArmory({
  payTo: '0xYourAddress...',
  amount: '1.0'
}));

// Advanced - multi-network, multi-token, multi-facilitator
app.use(acceptPaymentsViaArmory({
  payTo: '0xYourAddress...',
  amount: '1.0',
  accept: {
    networks: ['base', 'ethereum', 'skale-base'],
    tokens: ['usdc', 'eurc'],
    facilitators: [
      { url: 'https://facilitator1.com' },
      { url: 'https://facilitator2.com' }
    ]
  }
}));
```

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

- [Quick Start Guide](./docs/quickstart) - Get started in minutes
- [Token Registry](./docs/tokens) - Pre-configured tokens and how to add your own
- [API Examples](./docs/examples) - Cross-reference examples for all input formats
- [Deployment Guide](./DEPLOYMENT.md) - Deploy your own facilitator
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
| **@armory/base** | Protocol types, encoding, EIP-712, network configs, validation |
| **@armory/middleware** | HTTP middleware for Bun, Express, Hono, Elysia |
| **@armory/client-viem** | Viem v2 payment client |
| **@armory/client-ethers** | Ethers.js v6 payment client |
| **@armory/client-web3** | Web3.js payment client |
| **@armory/tokens** | Pre-configured token objects |
| **@armory/facilitator** | Payment verification and settlement server |
| **armory-cli** | Scaffold tool for x402 payment-enabled apps |

## Development

```bash
# Install dependencies
bun install

# Run tests
bun test

# Run tests for a specific package
bun test packages/core
```

## Automatic Validation

Armory validates everything upfront with clear error messages:

```typescript
// Token on wrong network
await armoryPay(wallet, url, 'ethereum', 'usdc');
// Error: TOKEN_NOT_ON_NETWORK
// "Token USDC is on chain 8453, but expected chain 1"

// Facilitator doesn't support network
await acceptPaymentsViaArmory({
  payTo: '0x...',
  accept: { networks: ['polygon'] },
  facilitators: [{ networks: ['base'] }]
});
// Error: FACILITATOR_NO_NETWORK_SUPPORT
// "Facilitator does not support network Polygon. Supported: Base"

// Facilitator doesn't support token
// Error: FACILITATOR_NO_TOKEN_SUPPORT
// "Facilitator does not support token EURC on Base. Supported: USDC"
```

## Protocol Reference

### X-402 Protocol

- **v1**: `X-PAYMENT` header (legacy)
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

| Version | Payment Header | Response Header |
|---------|---------------|-----------------|
| v1 | `X-PAYMENT` | `X-PAYMENT-RESPONSE` |
| v2 | `PAYMENT-SIGNATURE` | `PAYMENT-RESPONSE` |

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
