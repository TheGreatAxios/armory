# Armory X-402 Express Server Example

A complete Express.js server example demonstrating the X-402 payment middleware integration.

## Features

- Protected routes requiring X-402 payment
- Public routes accessible without payment
- Returns 402 with payment requirements when payment is missing

## Installation

```bash
# Install dependencies
bun install
```

## Configuration

Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
```

Edit `.env`:

```env
# Server port
PORT=3000

# Your wallet address to receive payments
PAYMENT_RECIPIENT=0xYourWalletAddressHere
```

## Running the Server

```bash
# Development mode with hot reload
bun run dev

# Production mode
bun run start
```

The server will start on `http://localhost:3000`

## API Endpoints

### Public Routes (No Payment Required)

#### `GET /health`
Health check endpoint

```bash
curl http://localhost:3000/health
```

#### `GET /api/info`
Public information about available endpoints

```bash
curl http://localhost:3000/api/info
```

#### `GET /api/payment-requirements`
Get payment requirements without making a payment

```bash
curl http://localhost:3000/api/payment-requirements
```

### Protected Routes (X-402 Payment Required)

#### `GET /api/protected`
Protected content endpoint (requires 1 USDC payment)

```bash
# Without payment - returns 402 with requirements
curl http://localhost:3000/api/protected

# With payment header
curl -H "PAYMENT-SIGNATURE: $(cat payment.json)" \
  http://localhost:3000/api/protected
```

#### `GET /api/premium-content`
Premium content endpoint (requires 5 USDC payment)

```bash
curl -H "PAYMENT-SIGNATURE: $(cat payment.json)" \
  http://localhost:3000/api/premium-content
```

#### `POST /api/actions/generate`
Paid action endpoint

```bash
curl -X POST \
  -H "Content-Type: application/json" \
  -H "PAYMENT-SIGNATURE: $(cat payment.json)" \
  -d '{"prompt":"Generate something cool"}' \
  http://localhost:3000/api/actions/generate
```

## Payment Flow

1. **Client requests protected resource** without payment
   ```bash
   curl http://localhost:3000/api/protected
   ```

2. **Server responds with 402** and payment requirements:
   ```json
   {
     "error": "Payment required",
     "requirements": {
       "amount": "1000000",
       "to": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
       "chainId": "eip155:8453",
       "assetId": "eip155:8453/erc20:0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
       "nonce": "...",
       "expiry": 1234567890
     }
   }
   ```

3. **Client creates payment** using an X-402 client:
   ```typescript
   import { createPayment } from "@armory/client-express";

   const payment = await createPayment({
     requirements: response.data.requirements,
     signer: wallet,
   });
   ```

4. **Client retries request** with payment header:
   ```bash
   curl -H "PAYMENT-SIGNATURE: $(payment.toJson())" \
     http://localhost:3000/api/protected
   ```

5. **Server verifies payment** and returns protected content

## Middleware Configuration

```typescript
import { paymentMiddleware } from "@armory/middleware";

app.use(
  "/api/protected",
  paymentMiddleware({
    requirements: {
      amount: "1000000", // 1 USDC
      to: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
      chainId: "eip155:8453",
      assetId: "eip155:8453/erc20:0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      nonce: crypto.randomUUID(),
      expiry: Math.floor(Date.now() / 1000) + 3600,
    },
    facilitatorUrl: process.env.FACILITATOR_URL,
  })
);
```

## Payment Information Access

The middleware attaches verified payment info to `req.payment`:

```typescript
app.get(
  "/api/protected",
  paymentMiddleware({ /* config */ }),
  (req: AugmentedRequest, res) => {
    const { payment } = req;

    console.log(payment?.payerAddress); // Payer's wallet address
    console.log(payment?.verified);     // Whether payment was verified
    console.log(payment?.version);      // Payment version (1 or 2)
    console.log(payment?.payload);      // Full payment payload
  }
);
```

## Testing

Create a test payment using the client library:

```typescript
import { createPayment } from "@armory/client-express";
import { wallet } from "./wallet";

const payment = await createPayment({
  requirements: {
    amount: "1000000",
    to: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
    chainId: "eip155:8453",
    assetId: "eip155:8453/erc20:0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    nonce: crypto.randomUUID(),
    expiry: Math.floor(Date.now() / 1000) + 3600,
  },
  signer: wallet,
});

// Use with fetch
const response = await fetch("http://localhost:3000/api/protected", {
  headers: {
    "PAYMENT-SIGNATURE": payment.toJson(),
  },
});
```

## Supported Networks

The example uses Base mainnet by default, but you can modify `PAYMENT_REQUIREMENTS` in `server.ts` to use other supported networks:

- Ethereum Mainnet (`eip155:1`)
- Base Mainnet (`eip155:8453`)
- Base Sepolia Testnet (`eip155:84532`)
- Ethereum Sepolia Testnet (`eip155:11155111`)

## License

MIT
