# @armory/client-ethers

X-402 protocol client implementation for ethers.js v6.

## Overview

This package provides an X-402 client that works with ethers.js Signers and Providers. It automatically handles 402 Payment Required responses by creating EIP-3009 signatures and retrying requests with payment headers.

## Key Features

- **Auto 402 Handling**: Automatically intercepts 402 responses and signs payments
- **EIP-3009 Signing**: Full support for EIP-3009 TransferWithAuthorization
- **V1 + V2 Protocol**: Supports both X-PAYMENT (v1) and PAYMENT-SIGNATURE (v2) headers
- **Type Safety**: Full TypeScript types exported
- **Flexible Configuration**: Configurable retries, timeouts, and callbacks

## Key Exports

### Main Functions

- `createX402Client(config)` - Create X-402 client with Signer
- `createX402Transport(config)` - Create fetch wrapper with payment handling
- `signPayment()` - Manual EIP-3009 payment signing
- `signEIP3009()` - Low-level EIP-3009 signing
- `recoverEIP3009Signer()` - Recover signer from signature

### Types

- `X402Client` - Client interface with fetch and HTTP methods
- `X402ClientConfig` - Configuration options
- `X402TransportConfig` - Transport configuration options

### Errors

- `X402ClientError` - Base error class
- `SigningError` - Signing operation failures
- `PaymentError` - Payment operation failures
- `WalletNotConfiguredError` - Missing wallet configuration
- `VersionDetectionError` - Cannot detect protocol version

## Usage

### Basic Setup

```ts
import { createX402Client } from "@armory/client-ethers";
import { BrowserProvider } from "ethers";

// Get signer from wallet
const provider = new BrowserProvider(window.ethereum);
const signer = await provider.getSigner();

// Create client
const client = createX402Client({ signer });

// Make requests - 402 handled automatically
const response = await client.get("https://api.example.com/protected");
const data = await response.json();
```

### Transport-Only Usage

```ts
import { createX402Transport } from "@armory/client-ethers";

const transport = createX402Transport({
  baseURL: "https://api.example.com",
  autoPay: true,
  onPaymentSuccess: (settlement) => {
    console.log("Payment successful:", settlement);
  },
});

transport.setSigner(signer);
const response = await transport.get("/protected-resource");
```

### Manual Payment Signing

```ts
import { signPayment } from "@armory/client-ethers";

// Using token object (recommended)
import { TOKENS } from "@armory/tokens";

const signature = await signPayment(
  signer,
  {
    token: TOKENS.USDC_BASE,
    amount: "1000000", // 1 USDC (6 decimals)
    to: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
  }
);

// Legacy approach (still supported)
const signature = await signPayment(
  signer,
  "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb", // from
  "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", // to
  1000000n, // 1 USDC (6 decimals)
  8453, // Base chain ID
  "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"  // USDC address
);
```

## API Reference

### `createX402Client(config)`

Create an X-402 client.

**Parameters:**
- `config.signer` - ethers.js Signer (can sign payments)
- `config.provider` - ethers.js Provider (read-only)
- `config.protocolVersion` - 1, 2, or "auto" (default)
- `config.defaultExpiry` - Authorization expiry in seconds (default: 3600)
- `config.network` - Network name for v1 protocol
- `config.usdcAddress` - USDC contract address

**Returns:** `X402Client` instance

### `X402Client`

#### Methods

- `fetch(url, init)` - Fetch with auto 402 handling
- `get(url, init)` - GET request
- `post(url, body, init)` - POST request
- `put(url, body, init)` - PUT request
- `delete(url, init)` - DELETE request
- `patch(url, body, init)` - PATCH request
- `setSigner(signer)` - Update signer
- `setProvider(provider)` - Update provider
- `configureTransport(config)` - Update transport config

### `createX402Transport(config)`

Create a transport layer for use with custom fetch logic.

**Parameters:**
- `config.baseURL` - Base URL for requests
- `config.headers` - Default headers
- `config.timeout` - Request timeout (ms)
- `config.autoPay` - Enable auto payment (default: true)
- `config.maxRetries` - Max retry attempts (default: 3)
- `config.retryDelay` - Delay between retries (ms)
- `config.onPaymentRequired` - Callback when payment required
- `config.onPaymentSuccess` - Callback when payment succeeds
- `config.onPaymentError` - Callback when payment fails

### EIP-3009 Functions

#### `signPayment(signer, from, to, value, chainId, verifyingContract, expirySeconds)`

Sign a payment authorization.

#### `signEIP3009(signer, params, domain)`

Sign EIP-3009 with full parameters.

#### `recoverEIP3009Signer(params, signature, domain)`

Recover signer address from signature.

## Protocol Support

### V1 Protocol

- Header: `X-PAYMENT`
- Format: Base64-encoded JSON
- Fields: `from`, `to`, `amount`, `nonce`, `expiry`, `v`, `r`, `s`, `chainId`, `contractAddress`, `network`

### V2 Protocol

- Header: `PAYMENT-SIGNATURE`
- Format: Raw JSON
- Fields: `from`, `to`, `amount`, `nonce`, `expiry`, `signature`, `chainId`, `assetId`, `extensions`

## Testing

```bash
bun test
```

## Dependencies

- `@armory/base` - Core types, utilities, and token registry
- `@armory/tokens` - Pre-configured token objects (optional)
- `ethers` v6 - Ethereum library

---

## Token Object Usage

### Using Pre-configured Tokens

```ts
import { createX402Client } from "@armory/client-ethers";
import { TOKENS } from "@armory/tokens";

const client = createX402Client({
  signer,
  defaultToken: TOKENS.USDC_BASE, // Set default token
});

// Override per-request
const response = await client.get("https://api.example.com/protected", {
  token: TOKENS.USDC_POLYGON,
});
```

### Registering Custom Tokens

```ts
import { registerToken } from "@armory/base";

registerToken({
  symbol: "MYTOKEN",
  name: "My Custom Token",
  version: "1",
  contractAddress: "0x...",
  chainId: 8453,
  decimals: 18,
});
```
