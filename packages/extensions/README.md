# @armory-sh/extensions

Armory x402 SDK — Protocol extensions for x402 payments. Add SIWX, payment ID, Bazaar discovery, and custom extensions.

[Documentation](https://armory.sh) | [License](LICENSE)

## Installation

```bash
bun add @armory-sh/extensions
```

## Why Armory?

Armory enables HTTP API payments via EIP-3009 `transferWithAuthorization`. Extensions add powerful functionality like authentication and idempotency.

## API Reference

### Hook Creators (Client-Side)

```typescript
import {
  createSIWxHook,
  createPaymentIdHook,
  createCustomHook,

  // Types
  type SIWxHookConfig,
  type PaymentIdHookConfig,
  type CustomHookConfig,
} from '@armory-sh/extensions';
```

### Server Extension Declaration

```typescript
import {
  // Sign-In-With-X
  declareSIWxExtension,
  createSIWxMessage,
  createSIWxPayload,
  encodeSIWxHeader,
  parseSIWxHeader,
  validateSIWxMessage,
  verifySIWxSignature,
  isSIWxExtension,

  // Payment Identifier
  declarePaymentIdentifierExtension,
  extractPaymentIdentifierInfo,
  isPaymentIdentifierExtension,
  validatePaymentIdentifierExtension,

  // Bazaar Discovery
  declareDiscoveryExtension,
  createDiscoveryConfig,
  extractDiscoveryInfo,
  isDiscoveryExtension,
  validateDiscoveryExtension,

  // Types
  type SIWxExtensionConfig,
  type PaymentIdentifierConfig,
  type BazaarDiscoveryConfig,
  type SIWxPayload,
} from '@armory-sh/extensions';
```

### Extension Utilities

```typescript
import {
  // Generic Extension
  createExtension,
  extractExtension,
  validateExtension,

  // Payment ID Generation
  generatePaymentId,

  // Constants
  SIGN_IN_WITH_X,
  PAYMENT_IDENTIFIER,
  BAZAAR,

  // Types
  type Extension,
  type SIWxExtensionInfo,
  type PaymentIdentifierExtensionInfo,
  type BazaarExtensionInfo,
} from '@armory-sh/extensions';
```

---

## Quick Start

### Sign-In-With-X (SIWX)

Wallet authentication for repeat access.

```typescript
import { createSIWxHook } from '@armory-sh/extensions'
import { createX402Client } from '@armory-sh/client-viem'

const client = createX402Client({
  wallet: { type: 'account', account },
  hooks: [
    createSIWxHook({
      domain: 'example.com',
      statement: 'Sign in to access premium content'
    })
  ]
})
```

### Payment Identifier

Idempotency for payment requests.

```typescript
import { createPaymentIdHook } from '@armory-sh/extensions'

const hook = createPaymentIdHook({ paymentId: 'my-custom-id' })
```

### Custom Hooks

Create your own extensions.

```typescript
import { createCustomHook } from '@armory-sh/extensions'

const customHook = createCustomHook({
  key: 'my-extension',
  handler: async (context) => {
    if (context.payload) {
      context.payload.extensions = {
        ...(context.payload.extensions ?? {}),
        'my-extension': { data: 'value' }
      }
    }
  },
  priority: 75
})
```

### Server Extension Declaration

For server-side middleware:

```typescript
import { declareSIWxExtension, declarePaymentIdentifierExtension } from '@armory-sh/extensions'

const siwxExt = declareSIWxExtension({
  domain: 'api.example.com',
  statement: 'Sign in to access this API'
})

const paymentIdExt = declarePaymentIdentifierExtension({ required: true })
```

## Features

- **Sign-In-With-X**: Wallet authentication for repeat access
- **Payment Identifier**: Idempotency for payment requests
- **Custom Hooks**: Create your own extensions
- **Server-Side**: Declare extensions for middleware

## License

MIT © [Sawyer Cutler](https://github.com/TheGreatAxios/armory)
