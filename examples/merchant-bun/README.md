# X-402 Merchant Server - Native Bun

Example merchant server using native Bun.serve with X-402 payment middleware. Demonstrates how to protect API routes with payment requirements.

## Features

- **Public Routes** - Welcome, health check, and product listing
- **Protected Routes** - Premium content, purchase, and user profile endpoints
- **Payment Middleware** - Automatic payment verification via X-402 headers
- **Native Bun** - Uses Bun.serve for optimal performance
- **Flexible Configuration** - Environment-based configuration
- **Settlement Modes** - Verify-only or automatic settlement

## Quick Start

1. **Install dependencies:**
   ```bash
   bun install
   ```

2. **Configure environment:**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. **Start the server:**
   ```bash
   bun start
   ```

The server will start on `http://localhost:3003`

## API Endpoints

### Public Routes

#### GET /
Welcome and API information.

```bash
curl http://localhost:3003/
```

#### GET /health
Health check endpoint.

```bash
curl http://localhost:3003/health
```

#### GET /products
List available products.

```bash
curl http://localhost:3003/products
```

### Protected Routes (Require Payment)

#### GET /api/premium
Access premium content (requires payment).

**Without payment:**
```bash
curl http://localhost:3003/api/premium
# Returns 402 with payment requirements
```

**With payment (using X-402 client):**
```bash
curl http://localhost:3003/api/premium \
  -H "PAYMENT-SIG: <signed_payment_payload>"
```

#### POST /api/purchase
Purchase endpoint (requires payment).

```bash
curl -X POST http://localhost:3003/api/purchase \
  -H "Content-Type: application/json" \
  -H "PAYMENT-SIG: <signed_payment_payload>" \
  -d '{"itemId": "premium_access"}'
```

#### GET /api/user/profile
Get user profile (requires payment).

```bash
curl http://localhost:3003/api/user/profile \
  -H "PAYMENT-SIG: <signed_payment_payload>"
```

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `3003` |
| `HOST` | Server host | `0.0.0.0` |
| `PAYMENT_TO_ADDRESS` | Payment recipient address | `0x742d...` |
| `PAYMENT_AMOUNT` | Payment amount (smallest unit) | `1000000` (1 USDC) |
| `PAYMENT_NETWORK` | Blockchain network | `base` |
| `PAYMENT_EXPIRY` | Payment expiry (seconds) | `3600` |
| `SETTLEMENT_MODE` | Payment mode (`verify` or `settle`) | `verify` |
| `FACILITATOR_URL` | Facilitator URL for verification/settlement | `http://localhost:3000` |
| `USDC_*` | USDC contract addresses | - |
| `RPC_*` | RPC URLs for local verification | - |

### Settlement Modes

**verify** (default)
- Only verifies the payment signature and balance
- Does not execute on-chain settlement
- Faster, no gas cost
- Use for API access, content gating

**settle**
- Verifies payment AND executes on-chain settlement
- Transfers USDC to merchant wallet
- Slower, requires gas
- Use for actual purchases, one-time access

### Supported Networks

- `ethereum` - Ethereum Mainnet
- `base` - Base
- `optimism` - Optimism
- `arbitrum` - Arbitrum One
- `polygon` - Polygon

## Payment Flow

1. **Client requests protected resource**
   ```bash
   curl http://localhost:3003/api/premium
   ```

2. **Server returns 402 with payment requirements**
   ```json
   {
     "error": "Payment required",
     "requirements": {
       "to": "0x742d...",
       "amount": "1000000",
       "expiry": 1736112000,
       "chainId": "eip155:8453",
       "assetId": "eip155:8453/erc20:0x8335..."
     }
   }
   ```

3. **Client creates and signs payment payload**
   ```typescript
   import { createPayment, signPayment } from "@armory/base";

   const payload = createPayment({
     to: "0x742d...",
     amount: "1000000",
     expiry: Math.floor(Date.now() / 1000) + 3600,
     chainId: "eip155:8453",
     assetId: "eip155:8453/erc20:0x8335...",
   });

   const signed = await signPayment(payload, wallet);
   ```

4. **Client retries request with payment**
   ```bash
   curl http://localhost:3003/api/premium \
     -H "PAYMENT-SIG: $(echo "$signed" | base64)"
   ```

5. **Server verifies payment and returns content**
   ```json
   {
     "message": "Welcome to the premium content!",
     "payer": "0x123...",
     "verified": true,
     "content": { ... },
     "settlement": {
       "success": true,
       "txHash": "0xabc..."
     }
   }
   ```

## Middleware Usage

```typescript
import { createBunMiddleware } from "@armory/middleware";

const middleware = createBunMiddleware({
  payTo: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
  network: "base",
  amount: "1000000",
  settlementMode: "settle",
  facilitator: {
    url: "http://localhost:3000",
  },
});

Bun.serve({
  async fetch(req) {
    const result = await middleware(req);
    if (result.status === 402) return result;

    // Payment verified - handle request
    const paymentData = await result.json();
    return new Response(`Hello ${paymentData.payerAddress}`);
  },
});
```

## Fire-and-Forget Settlement

The middleware supports fire-and-forget settlement mode:

```typescript
const middleware = createBunMiddleware({
  // ... other config
  waitForSettlement: false, // Don't wait for settlement
});

// Settlement happens in background
// Response returns immediately after verification
```

## Testing with X-402 Client

See the client examples for how to make authenticated requests:

```bash
cd ../client-viem
bun run client.ts
```

## Architecture

```
Client Request
       |
       v
+-------------+
| Bun.serve   |
+-------------+
       |
       v
+-------------------------+
| Payment Middleware      |
| - Read PAYMENT-SIG hdr  |
| - Decode & validate     |
| - Verify/settle payment |
| - Return response       |
+-------------------------+
       |
       v
+-------------+
| Route       |
| Handler     |
+-------------+
```

## Production Considerations

1. **Use HTTPS** - Required for production payments
2. **Set appropriate expiry** - Balance UX and security
3. **Rate limiting** - Prevent abuse
4. **Logging** - Track payment verifications
5. **Error handling** - Graceful payment failures
6. **Facilitator URL** - Use dedicated facilitator for scalability
7. **Settlement mode** - Choose verify vs settle based on use case
