# @armory-sh/base

Armory x402 SDK — Core protocol types, EIP-712 signing, encoding, network configs, and token registry. 100% compatible with Coinbase x402 SDKs.

[Documentation](https://armory.sh) | [License](LICENSE)

## Installation

```bash
bun add @armory-sh/base
```

## Why Armory?

Armory enables HTTP API payments via EIP-3009 `transferWithAuthorization`. Let your users pay with USDC directly from their wallet—no credit cards, no middlemen, no gas for payers.

## API Reference

### Protocol Types

```typescript
import type {
  // V2 Protocol (x402 v2 / CAIP)
  PaymentPayloadV2,
  PaymentRequirementsV2,
  PaymentRequiredV2,
  SettlementResponseV2,
  PayToV2,
  EIP3009Authorization,
  Extensions,
  ResourceInfo,
  Signature,
  Address,
  CAIPAssetId,

  // Unified Types
  PaymentPayload,
  PaymentRequirements,
  SettlementResponse,
} from '@armory-sh/base';
```

### Encoding / Decoding

```typescript
import {
  // V2 Encoding
  encodePaymentV2,
  decodePaymentV2,
  encodeSettlementV2,
  decodeSettlementV2,

  // x402 Cross-Version Encoding
  encodePayment,
  decodePayment,
  encodeSettlementResponse,
  decodeSettlementResponse,
  encodeX402Response,
  decodeX402Response,

  // Base64 Utilities
  safeBase64Encode,
  safeBase64Decode,
  toBase64Url,
  normalizeBase64Url,
  encodeUtf8ToBase64,
  decodeBase64ToUtf8,

  // Header Creation
  createPaymentRequiredHeaders,
  createSettlementHeaders,
  extractPaymentFromHeaders,

  // Type Guards
  isPaymentV2,
  isSettlementV2,
  isX402V2Payload,
  isX402V2PaymentRequired,
  isX402V2Settlement,
  isPaymentPayload,
  detectPaymentVersion,
} from '@armory-sh/base';
```

### EIP-712 (EIP-3009 Signing)

```typescript
import {
  // Domain & Typed Data
  createEIP712Domain,
  EIP712_TYPES,
  USDC_DOMAIN,

  // Transfer With Authorization
  createTransferWithAuthorization,
  validateTransferWithAuthorization,

  // Types
  type EIP712Domain,
  type TransferWithAuthorization,
  type TypedDataDomain,
} from '@armory-sh/base';
```

### Networks

```typescript
import {
  // Network Registry
  NETWORKS,
  getNetworkConfig,
  getNetworkByChainId,
  getMainnets,
  getTestnets,

  // Network Resolution
  resolveNetwork,
  normalizeNetworkName,
  getAvailableNetworks,

  // CAIP-2 Conversion
  networkToCaip2,
  caip2ToNetwork,

  // Types
  type NetworkConfig,
  type ResolvedNetwork,
} from '@armory-sh/base';
```

**Supported Networks**

| Key | Chain ID | Name |
|-----|----------|------|
| `ethereum` | 1 | Ethereum Mainnet |
| `base` | 8453 | Base Mainnet |
| `base-sepolia` | 84532 | Base Sepolia |
| `skale-base` | 1187947933 | SKALE Base |
| `skale-base-sepolia` | 324705682 | SKALE Base Sepolia |
| `ethereum-sepolia` | 11155111 | Ethereum Sepolia |

### Tokens

```typescript
import {
  // Pre-configured Tokens
  TOKENS,
  USDC_BASE,
  USDC_BASE_SEPOLIA,
  EURC_BASE,
  getUSDCTokens,
  getEURCTokens,
  getAllTokens,
  getTokensByChain,
  getTokensBySymbol,

  // Custom Token Registry
  registerToken,
  getCustomToken,
  getAllCustomTokens,
  unregisterToken,
  isCustomToken,

  // Token Resolution
  resolveToken,
  getAvailableTokens,
  addressToAssetId,
  assetIdToAddress,

  // Types
  type CustomToken,
  type ResolvedToken,
} from '@armory-sh/base';
```

**Supported Tokens**

USDC, EURC, USDT, WBTC, WETH, SKL across supported networks.

### Protocol Utilities

```typescript
import {
  // Nonce & Time
  generateNonce,
  createNonce,
  getCurrentTimestamp,
  calculateValidBefore,

  // Parsing
  parseJsonOrBase64,

  // Headers
  getPaymentHeaderName,
  PAYMENT_REQUIRED_HEADER,
  PAYMENT_SIGNATURE_HEADER,
  PAYMENT_RESPONSE_HEADER,

  // Version Detection
  detectX402Version,
  X402_VERSION,
} from '@armory-sh/base';
```

### Payment Requirements (Middleware)

```typescript
import {
  // Requirement Creation
  createPaymentRequirements,

  // Requirement Lookup
  findRequirementByNetwork,
  findRequirementByAccepted,

  // Types
  type PaymentConfig,
  type ResolvedRequirementsConfig,
} from '@armory-sh/base';
```

### Validation

```typescript
import {
  // Network & Token Validation
  resolveNetwork,
  resolveToken,
  validatePaymentConfig,
  validateAcceptConfig,

  // Facilitator Validation
  resolveFacilitator,
  checkFacilitatorSupport,

  // Error Creation
  createError,

  // Type Guards
  isValidationError,
  isResolvedNetwork,
  isResolvedToken,

  // Available Options
  getAvailableNetworks,
  getAvailableTokens,
} from '@armory-sh/base';
```

### Utilities

```typescript
import {
  // Unit Conversion
  toAtomicUnits,
  fromAtomicUnits,

  // Address Utilities
  normalizeAddress,
  isValidAddress,
  isAddress,

  // Route Matching
  matchRoute,
  parseRoutePattern,
  findMatchingRoute,
  validateRouteConfig,

  // Types
  type RouteMatcher,
  type RoutePattern,
} from '@armory-sh/base';
```

### Client Hooks Runtime

```typescript
import {
  // Hook Execution
  runOnPaymentRequiredHooks,
  runBeforeSignPaymentHooks,
  runAfterPaymentResponseHooks,
  selectRequirementWithHooks,

  // Types
  type ClientHook,
  type OnPaymentRequiredHook,
  type BeforePaymentHook,
  type PaymentRequiredContext,
  type PaymentPayloadContext,
  type ClientHookErrorContext,
} from '@armory-sh/base';
```

### ERC20 ABI

```typescript
import {
  ERC20_ABI,

  // Types
  type ERC20Abi,
  type TransferWithAuthorizationParams,
  type BalanceOfParams,
} from '@armory-sh/base';
```

### Payment Client (Facilitator)

```typescript
import {
  // Payment Operations
  verifyPayment,
  settlePayment,

  // Payload Extraction
  decodePayloadHeader,
  extractPayerAddress,

  // Facilitator Discovery
  getSupported,

  // Types
  type FacilitatorClientConfig,
  type SupportedResponse,
} from '@armory-sh/base';
```

### Error Classes

```typescript
import {
  X402ClientError,
  SigningError,
  PaymentException,
} from '@armory-sh/base';
```

### Headers Constants

```typescript
import {
  PAYMENT_REQUIRED_HEADER,
  PAYMENT_SIGNATURE_HEADER,
  PAYMENT_RESPONSE_HEADER,
  V2_HEADERS,
} from '@armory-sh/base';
```

---

## Quick Start

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

## License

MIT © [Sawyer Cutler](https://github.com/TheGreatAxios/armory)
