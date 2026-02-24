# @armory-sh/cdp-auth

Coinbase Developer Platform (CDP) JWT authentication for x402 facilitator calls.

Generates Bearer tokens (JWTs) compatible with the [Coinbase CDP API authentication](https://docs.cdp.coinbase.com/api-reference/v2/authentication#generate-bearer-token-jwt-and-export) and provides helpers for calling the Coinbase x402 facilitator `/verify` and `/settle` endpoints.

## Installation

```bash
bun add @armory-sh/cdp-auth
```

## Usage

### Generate a CDP JWT

```typescript
import { generateCdpJwt } from '@armory-sh/cdp-auth'

const token = await generateCdpJwt({
  apiKeyId: 'your-api-key-id',
  apiKeySecret: '-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n',
  requestMethod: 'POST',
  requestHost: 'api.cdp.coinbase.com',
  requestPath: '/platform/x402/v2/verify',
})
// Returns a JWT Bearer token
```

### Verify a Payment via CDP Facilitator

```typescript
import { cdpVerify } from '@armory-sh/cdp-auth'

const credentials = {
  apiKeyId: 'your-api-key-id',
  apiKeySecret: process.env.CDP_API_KEY_SECRET!,
}

const result = await cdpVerify(paymentPayload, paymentRequirements, credentials)
console.log(result.isValid) // true | false
```

### Settle a Payment via CDP Facilitator

```typescript
import { cdpSettle } from '@armory-sh/cdp-auth'

const result = await cdpSettle(paymentPayload, paymentRequirements, credentials)
console.log(result.success) // true | false
console.log(result.transaction) // tx hash
```

### Create a Facilitator Config

For use with `@armory-sh/base` middleware functions that accept a `FacilitatorClientConfig`:

```typescript
import { createCdpFacilitatorConfig } from '@armory-sh/cdp-auth'
import { verifyPayment, settlePayment } from '@armory-sh/base'

const credentials = {
  apiKeyId: 'your-api-key-id',
  apiKeySecret: process.env.CDP_API_KEY_SECRET!,
}

// For verify calls
const verifyConfig = await createCdpFacilitatorConfig(credentials, '/verify')
const result = await verifyPayment(payload, requirements, verifyConfig)

// For settle calls
const settleConfig = await createCdpFacilitatorConfig(credentials, '/settle')
const settlement = await settlePayment(payload, requirements, settleConfig)
```

## Supported Key Formats

- **EC (ES256)**: PEM-encoded PKCS8 private key (`-----BEGIN PRIVATE KEY-----`)
- **Ed25519 (EdDSA)**: Base64-encoded 64-byte key (Coinbase CDP format)

## API

### `generateCdpJwt(options: CdpJwtOptions): Promise<string>`

Generates a CDP JWT Bearer token.

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `apiKeyId` | string | ✓ | CDP API Key ID |
| `apiKeySecret` | string | ✓ | PEM EC key or base64 Ed25519 key |
| `requestMethod` | string | ✓ | HTTP method (e.g. `"POST"`) |
| `requestHost` | string | ✓ | Host (e.g. `"api.cdp.coinbase.com"`) |
| `requestPath` | string | ✓ | Request path (e.g. `"/platform/x402/v2/verify"`) |
| `expiresIn` | number | | Expiry in seconds (default: `120`) |

### `cdpVerify(payload, requirements, credentials): Promise<VerifyResponse>`

Verifies a payment using the Coinbase CDP x402 facilitator.

### `cdpSettle(payload, requirements, credentials): Promise<SettlementResponse>`

Settles a payment using the Coinbase CDP x402 facilitator.

### `createCdpFacilitatorConfig(credentials, path?): Promise<FacilitatorClientConfig>`

Creates a `FacilitatorClientConfig` with pre-generated CDP auth headers. Useful for integrating with Armory middleware.

### Constants

- `CDP_FACILITATOR_URL` — `"https://api.cdp.coinbase.com/platform/x402/v2"`
- `CDP_FACILITATOR_HOST` — `"api.cdp.coinbase.com"`
