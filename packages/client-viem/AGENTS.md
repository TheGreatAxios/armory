# @armory-sh/client-viem

x402 payment client for viem-based EVM wallets.

---

## Code Style

- **TypeScript strict mode** - No `any`, use proper typing
- **ES Modules** - Use `import { x } from 'y'` at top of files
- **No IIFE** - Use named functions
- **No dynamic imports** - All imports at compile time
- **Avoid closures** - Prefer explicit function parameters over captured variables
- **No OOP classes** - Prefer functional patterns
- **Modular exports** - Export functions individually

---

## Testing

- **NEVER skip tests** - Do not use `test.skip`, `describe.skip`, or `test.todo`

```bash
# Run tests
bun test

# Build package
bun run build

# Watch mode for development
bun --hot ./src/index.ts
```

## Key Exports

### Main Functions

- `createX402Client(config)` - Create x402 client with Account or WalletClient
- `createX402Transport(config)` - Create fetch wrapper with payment handling

### Types

- `X402Client` - Client interface with fetch method
- `X402ClientConfig` - Configuration options
- `X402Wallet` - Union type for Account | WalletClient
- `X402ProtocolVersion` - 1 | 2 | "auto"
- `Token` - Token configuration interface
- `PaymentResult` - Result of payment operation
- `X402TransportConfig` - Transport configuration options

### Errors

- `X402ClientError` - Base error class
- `SigningError` - Signing operation failures
- `PaymentError` - Payment operation failures

## Usage Patterns

### Basic Usage with Account

```ts
import { createX402Client } from "@armory-sh/client-viem";
import { privateKeyToAccount } from "viem/accounts";

const account = privateKeyToAccount("0x...");

const client = createX402Client({
  wallet: { type: "account", account },
});

// Automatic payment handling
const response = await client.fetch("https://api.example.com/data");
```

### Usage with WalletClient

```ts
import { createX402Client } from "@armory-sh/client-viem";
import { createWalletClient, custom } from "viem";
import { base } from "viem/chains";

const walletClient = createWalletClient({
  chain: base,
  transport: custom(window.ethereum),
});

const client = createX402Client({
  wallet: { type: "walletClient", walletClient },
});

const response = await client.fetch("https://api.example.com/data");
```

### Manual Payment Creation

```ts
// Using token object (recommended)
import { TOKENS } from "@armory-sh/base";

const payment = await client.createPayment({
  token: TOKENS.USDC_BASE,
  amount: "1.5",
  payTo: payToAddress,
});

// Legacy approach (still supported)
const payment = await client.createPayment(
  "1.5",        // amount in USDC
  payToAddress, // recipient address
  usdcAddress,  // USDC contract address
  8453          // chain ID (Base)
);
```

### Transport Wrapper

```ts
import { createX402Transport } from "@armory-sh/client-viem";

const fetchWithPayment = createX402Transport({
  transport: http(),
  payment: {
    wallet: { type: "account", account },
    version: "auto",
  },
});

// Use as drop-in replacement for fetch
const response = await fetchWithPayment("https://api.example.com/data");
```

### Configuration Options

```ts
const client = createX402Client({
  wallet: { type: "account", account },
  version: "auto",           // "auto" | 1 | 2
  defaultExpiry: 3600,       // seconds (default: 1 hour)
  nonceGenerator: () => `${Date.now()}`,
  debug: true,               // enable logging
});
```

## Protocol Support

- **v1 (X-PAYMENT)**: Base64-encoded JSON with v, r, s signature
- **v2 (PAYMENT-SIGNATURE)**: JSON with structured signature object
- **Auto-detection**: Automatically detects server protocol version

---

## Token Object Usage

### Using Pre-configured Tokens

```ts
import { createX402Client } from "@armory-sh/client-viem";
import { TOKENS } from "@armory-sh/base";

const client = createX402Client({
  wallet: { type: "account", account },
  defaultToken: TOKENS.USDC_BASE, // Set default token
});

// Override per-request
const response = await client.fetch("https://api.example.com/data", {
  token: TOKENS.USDC_POLYGON,
});
```

### Registering Custom Tokens

```ts
import { registerToken } from "@armory-sh/base";

registerToken({
  symbol: "MYTOKEN",
  name: "My Custom Token",
  version: "1",
  contractAddress: "0x...",
  chainId: 8453,
  decimals: 18,
});

const client = createX402Client({
  wallet: { type: "account", account },
  defaultToken: {
    symbol: "MYTOKEN",
    name: "My Custom Token",
    version: "1",
    contractAddress: "0x...",
    chainId: 8453,
  },
});
```

## Integration Points

- Uses EIP-712 typed data signing (EIP-3009)
- Supports all viem Account types
- Compatible with viem WalletClient interface
- Auto-retry on 402 responses
