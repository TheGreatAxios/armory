# E2E Tests

End-to-end tests that verify Armory middleware works with external x402 SDKs.

## Prerequisites

1. Install dependencies:
```bash
bun install
```

2. Get testnet USDC:
   - Base Sepolia: https://faucet.quicknode.com/base/sepolia

## Running Tests

### Start a Test Server

First, start your middleware server. For example, with Hono:

```bash
# Terminal 1
cd packages/middleware-hono
bun run src/index.ts  # or your server entrypoint
```

### Run Faremeter Test

```bash
# Terminal 2
TEST_PRIVATE_KEY=0x... bun x tests/e2e/test-faremeter.ts
```

### Run Coinbase x402 Test

```bash
# Terminal 2
TEST_PRIVATE_KEY=0x... bun x tests/e2e/test-coinbase.ts
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `TEST_PRIVATE_KEY` | Private key with testnet USDC | (required) |
| `SERVER_URL` | Server URL | `http://localhost:8787` |

## Test Files

- `test-faremeter.ts` - Tests Faremeter SDK compatibility
- `test-coinbase.ts` - Tests Coinbase x402 SDK compatibility
- `config.ts` - Shared test configuration

## Expected Results

### Faremeter Test
- Should receive 402 Payment Required
- Should have `PAYMENT-REQUIRED` or `X-PAYMENT-REQUIRED` header
- Header should contain valid base64-encoded payment requirements

### Coinbase Test  
- Should receive 402 Payment Required
- Should have `PAYMENT-REQUIRED` header
- Header should be base64-encoded JSON with `x402Version: 2`
