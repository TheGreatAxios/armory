# @armory-sh/base

Armory x402 SDK — Core protocol types, EIP-712 signing, encoding, network configs, and token registry. 100% compatible with Coinbase x402 SDKs.

[Documentation](https://armory.sh) | [License](LICENSE)

## Installation

```bash
bun add @armory-sh/base
```

## Why Armory?

Armory enables HTTP API payments via EIP-3009 `transferWithAuthorization`. Let your users pay with USDC directly from their wallet—no credit cards, no middlemen, no gas for payers.

## Key Exports

```typescript
import {
  // Types
  type PaymentPayload,
  type PaymentPayloadV2,
  type PaymentRequirementsV2,
  type SettlementResponseV2,
  type CustomToken,
  type NetworkConfig,

  // Encoding/Decoding
  encodePaymentV2,
  decodePaymentV2,
  encodeSettlementV2,
  decodeSettlementV2,
  safeBase64Encode,
  safeBase64Decode,

  // EIP-712
  createEIP712Domain,
  createTransferWithAuthorization,
  validateTransferWithAuthorization,
  EIP712_TYPES,

  // Networks
  NETWORKS,
  getNetworkConfig,
  getNetworkByChainId,
  getMainnets,
  getTestnets,

  // Token Registry
  TOKENS,
  registerToken,
  getCustomToken,
  getAllCustomTokens,
  unregisterToken,
  isCustomToken,

  // Utilities
  createNonce,
  toAtomicUnits,
  fromAtomicUnits,
  resolveNetwork,
  resolveToken,
} from '@armory-sh/base';
```

## Quick Start

### Pre-configured Tokens

```typescript
import { TOKENS } from '@armory-sh/base'

const usdc = TOKENS.USDC_BASE
console.log(usdc)
// {
//   symbol: 'USDC',
//   name: 'USD Coin',
//   contractAddress: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
//   chainId: 8453,
//   decimals: 6
// }
```

### Create EIP-712 Domain

```typescript
import { createEIP712Domain } from '@armory-sh/base'

const domain = createEIP712Domain({
  verifyingContract: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  chainId: 8453
})
```

### Generate Nonce

```typescript
import { createNonce } from '@armory-sh/base'

const nonce = createNonce()
// '0x0000000000000000000000000000000000000000000000000000000000000001'
```

### Register Custom Token

```typescript
import { registerToken, type CustomToken } from '@armory-sh/base'

const myToken: CustomToken = {
  symbol: 'MYTOKEN',
  name: 'My Custom Token',
  version: '1',
  contractAddress: '0x...',
  chainId: 8453,
  decimals: 18,
}

registerToken(myToken)
```

### Encode/Decode Payment

```typescript
import { encodePaymentV2, decodePaymentV2 } from '@armory-sh/base'

const payload = {
  chainId: 'eip155:8453',
  assetId: 'eip155:8453/erc20:0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  payTo: '0x...',
  signature: {
    from: '0x...',
    to: '0x...',
    value: '1000000',
    validAfter: '0',
    validBefore: '1736899200',
    nonce: '0x0000000000000000000000000000000000000000000000000000000000000001',
    signature: { r: '0x...', s: '0x...', v: 28 }
  }
}

// Encode for HTTP header
const encoded = encodePaymentV2(payload)

// Decode from HTTP header
const decoded = decodePaymentV2(encoded)
```

## Features

- **x402 v2 Protocol**: Full compatibility with Coinbase x402 SDKs
- **EIP-3009 / EIP-712**: Typed data signing for secure off-chain payments
- **Network Registry**: Ethereum, Base, SKALE — mainnets and testnets
- **Token Registry**: USDC, EURC, USDT, WBTC, WETH, SKL
- **Custom Tokens**: Register your own tokens
- **Encoding**: Base64URL encoding for HTTP headers

## Supported Networks

| Network | Chain ID |
|---------|----------|
| Ethereum | 1 |
| Base | 8453 |
| Base Sepolia | 84532 |
| SKALE Base | 1187947933 |
| SKALE Base Sepolia | 324705682 |
| Ethereum Sepolia | 11155111 |

## License

MIT © [Sawyer Cutler](https://github.com/TheGreatAxios/armory)
