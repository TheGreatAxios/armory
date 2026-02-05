# X-402 Merchant Server - Express.js

Example merchant server using Express.js with X-402 payment middleware. Demonstrates how to protect API routes with payment requirements.

## Features

- **Public Routes** - Welcome, health check, and product listing
- **Protected Routes** - Premium content, purchase, and user profile endpoints
- **Payment Middleware** - Automatic payment verification via X-402 headers
- **Express Integration** - Uses standard Express middleware pattern
- **Flexible Configuration** - Environment-based configuration

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

The server will start on `http://localhost:3001`

## API Endpoints

### Public Routes

#### GET /
Welcome and API information.

```bash
curl http://localhost:3001/
```

#### GET /health
Health check endpoint.

```bash
curl http://localhost:3001/health
```

#### GET /products
List available products.

```bash
curl http://localhost:3001/products
```

### Protected Routes (Require Payment)

#### GET /api/premium
Access premium content (requires payment).

**Without payment:**
```bash
curl http://localhost:3001/api/premium
# Returns 402 with payment requirements
```

**With payment (using X-402 client):**
```bash
curl http://localhost:3001/api/premium \
  -H "PAYMENT-SIG: <signed_payment_payload>"
```

#### POST /api/purchase
Purchase endpoint (requires payment).

```bash
curl -X POST http://localhost:3001/api/purchase \
  -H "Content-Type: application/json" \
  -H "PAYMENT-SIG: <signed_payment_payload>" \
  -d '{"itemId": "premium_access"}'
```

#### GET /api/user/profile
Get user profile (requires payment).

```bash
curl http://localhost:3001/api/user/profile \
  -H "PAYMENT-SIG: <signed_payment_payload>"
```

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `3001` |
| `HOST` | Server host | `0.0.0.0` |
| `PAYMENT_TO_ADDRESS` | Payment recipient address | `0x742d...` |
| `PAYMENT_AMOUNT` | Payment amount (smallest unit) | `1000000` (1 USDC) |
| `PAYMENT_NETWORK` | Blockchain network | `base` |
| `PAYMENT_EXPIRY` | Payment expiry (seconds) | `3600` |
| `FACILITATOR_URL` | Optional facilitator URL for remote verification | - |
| `USDC_*` | USDC contract addresses | - |
| `RPC_*` | RPC URLs for local verification | - |

### Supported Networks

- `ethereum` - Ethereum Mainnet
- `base` - Base
- `optimism` - Optimism
- `arbitrum` - Arbitrum One
- `polygon` - Polygon

## Payment Flow

1. **Client requests protected resource**
   ```bash
   curl http://localhost:3001/api/premium
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
   import { createPayment, signPayment } from "@armory/core";

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
   curl http://localhost:3001/api/premium \
     -H "PAYMENT-SIG: $(echo "$signed" | base64)"
   ```

5. **Server verifies payment and returns content**
   ```json
   {
     "message": "Welcome to the premium content!",
     "payer": "0x123...",
     "verified": true,
     "content": { ... }
   }
   ```

## Middleware Usage

```typescript
import express from "express";
import { paymentMiddleware } from "@armory/middleware";

const app = express();

// Protect a route with payment middleware
app.get("/api/protected",
  paymentMiddleware({
    requirements: {
      to: "0x742d...",
      amount: "1000000",
      expiry: Math.floor(Date.now() / 1000) + 3600,
      chainId: "eip155:8453",
      assetId: "eip155:8453/erc20:0x8335...",
    },
    facilitatorUrl: "http://localhost:3000", // Optional
  }),
  (req, res) => {
    // Payment info attached to req.payment
    const { payerAddress, verified } = req.payment;
    res.json({ message: `Hello ${payerAddress}` });
  }
);
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
| Express App |
+-------------+
       |
       v
+-------------------------+
| Payment Middleware      |
| - Read PAYMENT-SIG hdr  |
| - Decode & validate     |
| - Verify payment        |
| - Attach req.payment    |
+-------------------------+
       |
       v
+-------------+
| Route       | <--- req.payment available
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
