# @armory-sh/extensions

Protocol extensions for the x402 payment standard.

## Installation

```bash
bun add @armory-sh/extensions
```

## Available Extensions

| Extension | Purpose |
|-----------|---------|
| Sign-In-With-X | Wallet authentication for repeat access |
| Payment Identifier | Idempotency for payment requests |
| Bazaar | Resource discovery |

## Hook Creators

### createSIWxHook

Creates a hook that handles Sign-In-With-X authentication:

```typescript
import { createSIWxHook } from '@armory-sh/extensions';
import { createX402Client } from '@armory-sh/client-viem';

const client = createX402Client({
  wallet: { type: 'account', account },
  hooks: {
    siwx: createSIWxHook({
      domain: 'example.com',
      statement: 'Sign in to access premium content'
    })
  }
});
```

### createPaymentIdHook

Creates a hook that adds payment idempotency:

```typescript
import { createPaymentIdHook } from '@armory-sh/extensions';

const hook = createPaymentIdHook({ paymentId: 'my-custom-id' });
```

### createCustomHook

Create custom extension hooks:

```typescript
import { createCustomHook } from '@armory-sh/extensions';

const customHook = createCustomHook({
  key: 'my-extension',
  handler: async (context) => {
    if (context.payload) {
      context.payload.extensions = {
        ...(context.payload.extensions ?? {}),
        'my-extension': { data: 'value' }
      };
    }
  },
  priority: 75
});
```

## Server Extension Declaration

For server-side middleware:

```typescript
import { declareSIWxExtension, declarePaymentIdentifierExtension } from '@armory-sh/extensions';

const siwxExt = declareSIWxExtension({
  domain: 'api.example.com',
  statement: 'Sign in to access this API'
});

const paymentIdExt = declarePaymentIdentifierExtension({ required: true });
```

## Exports

| Export | Description |
|--------|-------------|
| `createSIWxHook` | Hook for Sign-In-With-X |
| `createPaymentIdHook` | Hook for payment idempotency |
| `createCustomHook` | Create custom hooks |
| `declareSIWxExtension` | Declare SIWX extension for server |
| `declarePaymentIdentifierExtension` | Declare payment ID extension |
| `validateSIWxMessage` | Validate SIWX payload |
| `verifySIWxSignature` | Verify SIWX signature |
| `generatePaymentId` | Generate random payment ID |

## License

MIT
