# @armory-sh/cdp-auth

Coinbase Developer Platform (CDP) JWT authentication for x402 facilitator calls.

Generates Bearer tokens (JWTs) compatible with the [Coinbase CDP API authentication](https://docs.cdp.coinbase.com/api-reference/v2/authentication#generate-bearer-token-jwt-and-export) and provides `generateCdpHeaders` to produce ready-to-use auth headers for any HTTP client or Armory middleware package.

## Installation

```bash
bun add @armory-sh/cdp-auth
```

## Usage

### Generate auth headers (for use with middleware or any HTTP client)

```typescript
import { generateCdpHeaders, CDP_FACILITATOR_URL } from '@armory-sh/cdp-auth'

const headers = await generateCdpHeaders({
  apiKeyId: 'your-api-key-id',
  apiKeySecret: process.env.CDP_API_KEY_SECRET!,
  requestMethod: 'POST',
  requestPath: '/verify',
})
// headers = { Authorization: 'Bearer <jwt>', 'Content-Type': 'application/json' }

// Pass to fetch or any Armory middleware
const response = await fetch(`${CDP_FACILITATOR_URL}/verify`, {
  method: 'POST',
  headers,
  body: JSON.stringify({ paymentPayload, paymentRequirements }),
})
```

### Generate a raw CDP JWT

```typescript
import { generateCdpJwt } from '@armory-sh/cdp-auth'

const token = await generateCdpJwt({
  apiKeyId: 'your-api-key-id',
  apiKeySecret: '-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n',
  requestMethod: 'POST',
  requestHost: 'api.cdp.coinbase.com',
  requestPath: '/platform/x402/v2/verify',
})
// Returns a raw JWT string
```

## Supported Key Formats

- **EC (ES256)**: PEM-encoded PKCS8 private key (`-----BEGIN PRIVATE KEY-----`)
- **Ed25519 (EdDSA)**: Base64-encoded 64-byte key (Coinbase CDP format)

## API

### `generateCdpHeaders(options: GenerateCdpHeadersOptions): Promise<Record<string, string>>`

Generates a fresh CDP JWT and returns HTTP headers ready to attach to a request.

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `apiKeyId` | string | ✓ | CDP API Key ID |
| `apiKeySecret` | string | ✓ | PEM EC key or base64 Ed25519 key |
| `requestMethod` | string | ✓ | HTTP method (e.g. `"POST"`) |
| `requestPath` | string | ✓ | Request path (e.g. `"/verify"`) |
| `expiresIn` | number | | Expiry in seconds (default: `120`) |

Returns `{ Authorization: "Bearer <jwt>", "Content-Type": "application/json" }`.

---

### `generateCdpJwt(options: CdpJwtOptions): Promise<string>`

Signs a raw CDP JWT bearer token.

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `apiKeyId` | string | ✓ | CDP API Key ID |
| `apiKeySecret` | string | ✓ | PEM EC key or base64 Ed25519 key |
| `requestMethod` | string | ✓ | HTTP method (e.g. `"POST"`) |
| `requestHost` | string | ✓ | Host (e.g. `"api.cdp.coinbase.com"`) |
| `requestPath` | string | ✓ | Request path (e.g. `"/platform/x402/v2/verify"`) |
| `expiresIn` | number | | Expiry in seconds (default: `120`) |

### Constants

- `CDP_FACILITATOR_URL` — `"https://api.cdp.coinbase.com/platform/x402/v2"`
- `CDP_FACILITATOR_HOST` — `"api.cdp.coinbase.com"`
