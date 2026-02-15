# @armory-sh/base

Core protocol library for x402. Types, encoding, EIP-712, network configs.

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

## Package Commands

- **NEVER skip tests** - Do not use `test.skip`, `describe.skip`, or `test.todo`

```bash
# From /packages/base
bun run build    # Build dist/
bun run test     # Run tests
```

---

## Key Exports

### Protocol Types

```typescript
// Unified types (v1 | v2)
import type { PaymentPayload, PaymentRequirements, SettlementResponse } from "@armory-sh/base"

// Version-specific types
import type { PaymentPayloadV1, PaymentPayloadV2 } from "@armory-sh/base"
```

### Encoding/Decoding

```typescript
import {
  encodePaymentV1,
  decodePaymentV1,
  encodePaymentV2,
  decodePaymentV2,
  detectPaymentVersion,
  decodePayment,
} from "@armory-sh/base"
```

### Type Guards

```typescript
import {
  isV1,
  isV2,
  getPaymentVersion,
  getRequirementsVersion,
  isSettlementSuccessful,
} from "@armory-sh/base"
```

### EIP-712

```typescript
import {
  createEIP712Domain,
  createTransferWithAuthorization,
  validateTransferWithAuthorization,
  EIP712_TYPES,
} from "@armory-sh/base"
```

### Networks

```typescript
import {
  NETWORKS,
  getNetworkConfig,
  getNetworkByChainId,
  getMainnets,
  getTestnets,
} from "@armory-sh/base"
```

### Custom Token Registry

```typescript
import {
  registerToken,
  getCustomToken,
  getAllCustomTokens,
  unregisterToken,
  isCustomToken,
  type CustomToken,
} from "@armory-sh/base"
```

### ERC20 ABI

```typescript
import { ERC20_ABI } from "@armory-sh/base"
```

---

## Protocol Versions

### V1 (Legacy)

```typescript
interface PaymentPayloadV1 {
  contractAddress: Address
  network: Network
  amount: string
  nonce: string
  validAfter: number
  validBefore: number
  signature: Signature
  v: number
}
```

### V2 (CAIP Compliant)

```typescript
interface PaymentPayloadV2 {
  chainId: CAIP2ChainId        // e.g., "eip155:1"
  assetId: CAIPAssetId         // e.g., "eip155:1/erc20:0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48"
  payTo: PayToV2
  signature: Signature
  extensions?: Extensions
}
```

---

## File Structure

```
src/
├── types/
│   ├── v1.ts          # V1 protocol types
│   ├── v2.ts          # V2 protocol types (CAIP)
│   ├── protocol.ts    # Unified types & type guards
│   └── networks.ts    # Network configs
├── abi/
│   └── erc20.ts       # ERC20 ABI (transferWithAuthorization)
├── encoding.ts        # Base64 encoding/decoding
├── eip712.ts          # EIP-712 typed data
└── index.ts           # Main exports
```

---

## Implementation Notes

- **V1 headers**: `X-PAYMENT`, `X-PAYMENT-RESPONSE`
- **V2 headers**: `PAYMENT-SIGNATURE`, `PAYMENT-RESPONSE`
- **Encoding**: Base64URL for header transport
- **Signature**: EIP-712 `TransferWithAuthorization` typed data
- **Networks**: Uses Viem's `Chain` type internally

---

## Token Object Usage

### Registering Custom Tokens

```typescript
import { registerToken, type CustomToken } from "@armory-sh/base";

// Register a custom token
const myToken: CustomToken = {
  symbol: "MYTOKEN",
  name: "My Custom Token",
  version: "1",
  contractAddress: "0x1234567890123456789012345678901234567890",
  chainId: 8453,
  decimals: 18,
};

registerToken(myToken);

// Retrieve registered token
const token = getCustomToken(8453, "0x1234567890123456789012345678901234567890");
console.log(token?.symbol); // "MYTOKEN"

// Check if token is registered
const isRegistered = isCustomToken(8453, "0x1234567890123456789012345678901234567890");

// Get all registered tokens
const allTokens = getAllCustomTokens();

// Unregister a token
unregisterToken(8453, "0x1234567890123456789012345678901234567890");
```

### Using Pre-configured Tokens

```typescript
import { TOKENS, registerToken } from "@armory-sh/base";

// Use pre-configured token
const usdcBase = TOKENS.USDC_BASE;
```

### CustomToken Interface

```typescript
interface CustomToken {
  symbol: string;              // Token symbol (e.g., "USDC")
  name: string;                // Token name (e.g., "USD Coin")
  version: string;             // Token version (e.g., "2")
  contractAddress: `0x${string}`; // Contract address
  chainId: number;             // Chain ID
  decimals?: number;           // Token decimals (optional)
}
```
