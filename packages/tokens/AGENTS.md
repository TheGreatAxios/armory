# @armory/tokens

Pre-configured token objects for X-402 Protocol.

## Overview

This package provides ready-to-use token configurations for common ERC-20 tokens across major EVM chains. Each token includes all necessary fields for EIP-712 signing and protocol interactions.

## Token Structure

```typescript
interface TokenConfig {
  symbol: string;              // Token symbol (e.g., "USDC")
  name: string;                // Token name (e.g., "USD Coin")
  version: string;             // Token version (e.g., "2")
  contractAddress: `0x${string}`; // Contract address
  chainId: number;             // Chain ID
  decimals?: number;           // Token decimals (optional)
  rpcUrl?: string;             // RPC URL (optional)
  domainName: string;          // EIP-712 domain name
  domainVersion: string;       // EIP-712 domain version
}
```

## Supported Tokens

### USDC (USD Coin)
- Ethereum Mainnet
- Base
- Optimism
- Arbitrum
- Polygon

### USDT (Tether USD)
- Ethereum Mainnet
- Base
- Optimism
- Arbitrum
- Polygon

### DAI (Dai Stablecoin)
- Ethereum Mainnet
- Base

### WBTC (Wrapped BTC)
- Ethereum Mainnet
- Base

### WETH (Wrapped Ether)
- Ethereum Mainnet

## Usage

```typescript
import { TOKENS, getToken, getUSDCTokens } from "@armory/tokens";
import { registerToken } from "@armory/core";

// Access specific token
const usdcBase = TOKENS.USDC_BASE;

// Register for use with X-402 protocol
registerToken(usdcBase);

// Get token by chain and address
const token = getToken(8453, "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913");

// Get all USDC tokens
const allUsdc = getUSDCTokens();
```

## Integration with X-402 Clients

### client-viem

```typescript
import { createX402Client } from "@armory/client-viem";
import { TOKENS } from "@armory/tokens";

const client = createX402Client({
  wallet: { type: "account", account },
  defaultToken: TOKENS.USDC_BASE,
});
```

### client-ethers

```typescript
import { createX402Client } from "@armory/client-ethers";
import { TOKENS } from "@armory/tokens";

const client = createX402Client({
  signer,
  defaultToken: TOKENS.USDC_BASE,
});
```

### client-web3

```typescript
import { createX402Client } from "@armory/client-web3";
import { TOKENS } from "@armory/tokens";

const client = createX402Client({
  account,
  network: "base",
  defaultToken: TOKENS.USDC_BASE,
});
```

### Registering Custom Tokens

```typescript
import { registerToken } from "@armory/core";

registerToken({
  symbol: "MYTOKEN",
  name: "My Custom Token",
  version: "1",
  contractAddress: "0x...",
  chainId: 8453,
  decimals: 18,
});
```

### Legacy vs Token Object Approach

```typescript
// New approach (recommended) - using token object
const payment = await client.createPayment({
  token: TOKENS.USDC_BASE,
  amount: "1.5",
  payTo: payToAddress,
});

// Legacy approach (still supported) - individual fields
const payment = await client.createPayment(
  "1.5",        // amount in USDC
  payToAddress, // recipient address
  usdcAddress,  // USDC contract address
  8453          // chain ID (Base)
);
```

## Building

```bash
bun run build
```

## Testing

```bash
bun test
```
