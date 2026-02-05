# Hono Server with X-402 Payment Middleware

Complete example of using `@armory/middleware` with Hono v4 to protect API routes with X-402 payment requirements.

## Features

- **Public routes** - No payment required
- **Protected routes** - Requires valid payment via `PAYMENT-SIGNATURE` header
- **Facilitator integration** - Optional payment verification and settlement
- **V2 protocol** - Uses the latest PAYMENT-SIGNATURE header format
- **Type-safe** - Full TypeScript support with Hono types

## Installation

```bash
# Install dependencies
bun install

# Copy environment file
cp .env.example .env

# Edit .env with your configuration
```

## Configuration

Edit `.env` file:

```env
PORT=3001                    # Server port
ENABLE_FACILITATOR=true      # Enable built-in facilitator
FACILITATOR_PORT=3000        # Facilitator port
BASE_RPC_URL=https://mainnet.base.org  # RPC URL
PRIVATE_KEY=0x...            # Optional: for on-chain settlement
```

## Usage

### Start the Server

```bash
# Development mode with hot reload
bun run dev

# Production mode
bun run start
```

The server will start on `http://localhost:3001`

## API Routes

### Public Routes

#### `GET /` - Health Check
```bash
curl http://localhost:3001/
```

#### `GET /api/public` - Public Endpoint
```bash
curl http://localhost:3001/api/public
```

#### `GET /api/requirements` - Payment Requirements
Returns the payment requirements for protected routes.

```bash
curl http://localhost:3001/api/requirements
```

Response:
```json
{
  "requirements": {
    "amount": "1000000",
    "to": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
    "expiry": 1234567890,
    "chainId": "eip155:8453",
    "assetId": "eip155:8453/erc20:0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"
  },
  "instructions": { ... }
}
```

### Protected Routes

#### `GET /api/protected` - Protected Endpoint (1 USDC)
Requires valid payment in `PAYMENT-SIGNATURE` header.

```bash
# Without payment - returns 402
curl http://localhost:3001/api/protected

# With payment - use @armory/client-hono to generate
```

#### `POST /api/protected` - Protected POST (1 USDC)
Same payment requirement, accepts POST requests.

#### `GET /api/premium` - Premium Endpoint (5 USDC)
Higher payment requirement (5 USDC).

## Payment Format

Protected routes require a `PAYMENT-SIGNATURE` header with a JSON-encoded payment payload:

```json
{
  "from": "0x...",
  "to": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
  "amount": "1000000",
  "chainId": "eip155:8453",
  "assetId": "eip155:8453/erc20:0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  "expiry": 1234567890,
  "nonce": "0x...",
  "signatures": ["0x..."]
}
```

## Client Integration

Use `@armory/client-hono` for easy integration:

```typescript
import { hc } from "hono/client";
import { createPaymentClient } from "@armory/client-hono";

const client = hc<AppType>("http://localhost:3001");
const paymentClient = createPaymentClient(client, {
  wallet: yourWallet,
  defaultRequirements: PAYMENT_REQUIREMENTS,
});

// Automatic payment handling
const response = await paymentClient.api.protected.$get();
```

## Facilitator Integration

The server includes an optional built-in facilitator for payment verification and settlement.

### Facilitator Endpoints

When enabled (`ENABLE_FACILITATOR=true`), the facilitator runs on port 3000:

- `GET /` - Health check
- `GET /supported` - Supported networks
- `POST /verify` - Verify payment
- `POST /settle` - Settle payment

### External Facilitator

To use an external facilitator, update `server.ts`:

```typescript
const requirePayment = honoPaymentMiddleware({
  requirements: PAYMENT_REQUIREMENTS,
  facilitatorUrl: "https://your-facilitator.com",
});
```

## Response Codes

- `200` - Success with valid payment
- `402` - Payment required or invalid
  - Includes `PAYMENT-REQUIRED` header with requirements
- `400` - Invalid payment payload
- `500` - Server error

## Testing

### Without Payment

```bash
curl -v http://localhost:3001/api/protected
```

Returns 402 with payment requirements.

### With Payment (Manual)

```bash
curl -v http://localhost:3001/api/protected \
  -H "PAYMENT-SIGNATURE: '{...encoded payment...}'"
```

### Type-Safe Client

```typescript
import { client } from "./server";

const response = await client.index.$get();
```

## Security Notes

1. **Never commit `.env`** - Contains sensitive keys
2. **Use environment variables** - For all configuration
3. **HTTPS in production** - Use TLS for all requests
4. **Validate requirements** - Ensure amount, expiry are correct
5. **Rate limiting** - Consider adding rate limiting middleware

## Architecture

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│   Client    │────>│ Hono Server  │────>│ Facilitator │
│ (with       │     │ (Middleware) │     │ (Optional)  │
│  Payment)   │     │              │     │             │
└─────────────┘     └──────────────┘     └─────────────┘
                           │
                           v
                    ┌──────────────┐
                    │ Protected    │
                    │ Route        │
                    └──────────────┘
```

## License

MIT
