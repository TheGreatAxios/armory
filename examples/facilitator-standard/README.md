# X-402 Standard Facilitator

Production-ready X-402 facilitator server with in-memory queue and nonce tracking.

## Features

- **Health Check** - Monitor server and queue status
- **Payment Verification** - Verify payment signatures, balances, and nonces
- **Payment Settlement** - Execute EIP-3009 USDC transfers
- **Supported Networks** - List all supported blockchain networks
- **Background Processing** - Async queue worker for settlement
- **Replay Protection** - In-memory nonce tracking
- **Graceful Shutdown** - Clean process termination

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

## API Endpoints

### GET /health

Health check with queue statistics.

**Response:**
```json
{
  "status": "ok",
  "timestamp": 1736025600000,
  "queue": {
    "pending": 0,
    "processing": 0,
    "completed": 42
  }
}
```

### GET /supported

List all supported blockchain networks.

**Response:**
```json
{
  "networks": [
    {
      "name": "Ethereum",
      "chainId": 1,
      "caip2Id": "eip155:1"
    },
    {
      "name": "Base",
      "chainId": 8453,
      "caip2Id": "eip155:8453"
    }
  ]
}
```

### POST /verify

Verify a payment signature, balance, and nonce.

**Request:**
```json
{
  "paymentPayload": {
    "from": "0x...",
    "to": "0x...",
    "amount": "1000000",
    "nonce": "123456",
    "expiry": 1736112000,
    "chainId": "eip155:8453",
    "assetId": "eip155:8453/erc20:0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
    "signature": {
      "v": 27,
      "r": "0x...",
      "s": "0x..."
    }
  },
  "paymentRequirements": {
    "to": "0x...",
    "amount": "1000000",
    "expiry": 1736112000
  },
  "skipBalanceCheck": false,
  "skipNonceCheck": false
}
```

**Response:**
```json
{
  "success": true,
  "payerAddress": "0x...",
  "balance": "10000000",
  "requiredAmount": "1000000"
}
```

### POST /settle

Settle a payment (enqueued for background processing by default).

**Request:**
```json
{
  "paymentPayload": { /* same as verify */ },
  "paymentRequirements": { /* same as verify */ },
  "enqueue": true
}
```

**Response (async):**
```json
{
  "success": true,
  "jobId": "job_1736025600000_abc123",
  "timestamp": 1736025600000
}
```

**Response (sync, enqueue: false):**
```json
{
  "success": true,
  "txHash": "0x...",
  "timestamp": 1736025600000
}
```

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `3000` |
| `HOST` | Server host | `0.0.0.0` |
| `PRIVATE_KEY` | Wallet private key for settlements | (simulated mode) |
| `RPC_ETHEREUM` | Ethereum RPC URL | `https://eth.llamarpc.com` |
| `RPC_BASE` | Base RPC URL | `https://mainnet.base.org` |
| `RPC_OPTIMISM` | Optimism RPC URL | `https://mainnet.optimism.io` |
| `RPC_ARBITRUM` | Arbitrum RPC URL | `https://arb1.arbitrum.io/rpc` |
| `RPC_POLYGON` | Polygon RPC URL | `https://polygon-rpc.com` |
| `QUEUE_POLL_INTERVAL` | Queue poll interval (ms) | `1000` |
| `QUEUE_MAX_RETRIES` | Max settlement retries | `3` |
| `NONCE_TTL` | Nonce entry TTL (ms) | `86400000` (24h) |

### Settlement Modes

**Simulated Mode (default)**
- No private key required
- Settlement returns a fake transaction hash
- Useful for testing and development

**Live Mode**
- Set `PRIVATE_KEY` in environment
- Executes actual on-chain settlements
- Requires gas for transactions

## Architecture

```
Client Request
       |
       v
+-------------+
|   HTTP API  | <--- Health, Verify, Settle, Supported
+-------------+
       |
       v
+-------------+     +------------------+     +------------------+
| Payment Queue |--->| Queue Worker     |--->| Blockchain       |
| (In-Memory)  |     | (Background)     |     | Settlement       |
+-------------+     +------------------+     +------------------+
       |
       v
+-------------+
| Nonce       |
| Tracker     |
| (In-Memory) |
+-------------+
```

## Testing

Use curl to test the endpoints:

```bash
# Health check
curl http://localhost:3000/health

# List supported networks
curl http://localhost:3000/supported

# Verify payment
curl -X POST http://localhost:3000/verify \
  -H "Content-Type: application/json" \
  -d '{"paymentPayload": {...}, "paymentRequirements": {...}}'

# Settle payment
curl -X POST http://localhost:3000/settle \
  -H "Content-Type: application/json" \
  -d '{"paymentPayload": {...}, "paymentRequirements": {...}}'
```

## Production Considerations

This example uses in-memory storage. For production deployments:

1. **Persist nonces** - Use Redis or database for nonce tracking
2. **Persist queue** - Use Redis Bull or similar for job queue
3. **Add monitoring** - Integrate with Prometheus/Datadog
4. **Add rate limiting** - Prevent abuse
5. **Use proper RPC** - Use dedicated RPC providers (Alchemy, Infura)
6. **Secure private key** - Use AWS KMS or similar for key management
