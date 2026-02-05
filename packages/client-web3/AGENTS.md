# @armory/client-web3 - AI Agent Context

## Overview

Web3.js client implementation for X402 protocol (micropayments for HTTP APIs). Supports both v1 (X-PAYMENT header) and v2 (PAYMENT-SIGNATURE header) protocols.

## Key Files

- `src/client.ts` - Main client implementation with `createX402Client()`
- `src/transport.ts` - Fetch wrapper with automatic 402 handling
- `src/eip3009.ts` - EIP-3009 / EIP-712 signing utilities
- `src/types.ts` - TypeScript type definitions
- `src/index.ts` - Public API exports

## Dependencies

- `@armory/base` - Core X402 protocol types and utilities
- `web3` ^4.0.0 - Web3.js library for wallet/account management

## Protocol Versions

### V1 (X-PAYMENT header)
- Base64-encoded JSON in `X-PAYMENT` header
- EIP-3009 TransferWithAuthorization with v, r, s signature components
- Response in `X-PAYMENT-RESPONSE` header

### V2 (PAYMENT-SIGNATURE header)
- Raw JSON in `PAYMENT-SIGNATURE` header
- CAIP-2 chain IDs, CAIP asset IDs
- Response in `PAYMENT-RESPONSE` header

## API Usage

### Creating a Client

```ts
import { createX402Client } from "@armory/client-web3";
import { Web3 } from "web3";

const web3 = new Web3();
const account = web3.eth.accounts.create();

const client = createX402Client({
  account,
  network: "base", // or "ethereum", "base-sepolia", etc.
  version: 2, // defaults to 2
});
```

### Using the Transport

```ts
import { createX402Transport } from "@armory/client-web3";

const transport = createX402Transport({ client });

// Automatic 402 handling
const response = await transport.fetch("https://api.example.com/data");
```

### Manual Payment Signing

```ts
// Using token object (recommended)
import { TOKENS } from "@armory/tokens";

const result = await client.signPayment({
  token: TOKENS.USDC_BASE,
  amount: "1000000", // 1 USDC (6 decimals)
  to: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
});

// Get headers
const headers = await client.createPaymentHeaders({
  token: TOKENS.USDC_BASE,
  amount: "1000000",
  to: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
});

// Legacy approach (still supported)
const result = await client.signPayment({
  amount: "1000000", // 1 USDC (6 decimals)
  to: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
});

// Get headers
const headers = await client.createPaymentHeaders({
  amount: "1000000",
  to: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
});
```

## Supported Networks

- Ethereum Mainnet (`ethereum`)
- Base Mainnet (`base`)
- Base Sepolia (`base-sepolia`)
- Ethereum Sepolia (`ethereum-sepolia`)

## EIP-3009 Signing

Note: Web3.js v4 has limited EIP-712 support. The client provides:

1. Type-safe message creation
2. Domain separator generation
3. Signature parsing utilities

For actual signing, the client expects:
- Wallet provider with `signTypedData()` method
- Or account with `privateKey` for fallback

## Test Commands

```bash
bun test                    # Run all tests
bun build ./src/index.ts    # Build the package
```

## Type Safety

Full TypeScript support with exported types:
- `Web3X402Client`
- `X402Transport`
- `PaymentSignOptions`
- `PaymentSignatureResult`
- And all core types re-exported from `@armory/base`

---

## Token Object Usage

### Using Pre-configured Tokens

```ts
import { createX402Client } from "@armory/client-web3";
import { TOKENS } from "@armory/tokens";

const client = createX402Client({
  account,
  network: "base",
  version: 2,
  defaultToken: TOKENS.USDC_BASE, // Set default token
});

// Override per-request
const result = await client.signPayment({
  token: TOKENS.USDC_POLYGON,
  amount: "1000000",
  to: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
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
