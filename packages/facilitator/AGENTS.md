# @armory/facilitator

Server-side payment settlement and verification library.

---

## Package Commands

```bash
# From /packages/facilitator
bun run build    # Build dist/
bun run test     # Run tests
```

---

## Key Exports

### Payment Verification

```typescript
import {
  verifyPayment,
  type VerifyPaymentOptions,
  type VerificationResult,
  PaymentVerificationError,
  InvalidSignatureError,
  InsufficientBalanceError,
  NonceUsedError,
  PaymentExpiredError,
  PaymentNotYetValidError,
  UnsupportedNetworkError,
  InvalidPayloadError,
} from "@armory/facilitator"
```

### Payment Settlement

```typescript
import {
  settlePayment,
  type SettlePaymentParams,
  type SettlementResult,
  SettlementError,
  ContractExecutionError,
  AuthorizationExpiredError,
} from "@armory/facilitator"
```

### Queue (Memory)

```typescript
import {
  MemoryQueue,
  createMemoryQueue,
  type PaymentQueue,
  type SettleJob,
  type SettleResult,
} from "@armory/facilitator"
```

### Nonce Tracker

```typescript
import {
  MemoryNonceTracker,
  createNonceTracker,
  type NonceTracker,
  type StoredNonce,
  NonceAlreadyUsedError,
} from "@armory/facilitator"
```

### HTTP Server

```typescript
import {
  createFacilitatorServer,
  type FacilitatorServerOptions,
  type FacilitatorServer,
} from "@armory/facilitator"
```

---

## Usage Patterns

### Verify Payment

```typescript
const result = await verifyPayment(payload, {
  walletClient,
  publicClient,
  nonceTracker,
  acceptedNetworks: ['ethereum', 'polygon'],
})

if (result.success) {
  // result.data.address
  // result.data.amount
  // result.data.validAfter
  // result.data.validBefore
}
```

### Settle Payment

```typescript
const receipt = await settlePayment({
  walletClient,
  publicClient,
  payload: result.data,
  contractAddress: '0x...',
  gasPrice: 20_000_000_000n,
})
```

### With Queue

```typescript
const queue = createMemoryQueue({
  maxConcurrent: 5,
  maxRetries: 3,
})

const jobId = await queue.add({
  payload,
  facilitatorAddress,
  network,
})

queue.on('complete', (jobId, result) => {
  console.log('Settled:', result.txHash)
})
```

### Using Token Objects

```typescript
import { TOKENS } from "@armory/tokens";
import { getCustomToken } from "@armory/core";

// Use pre-configured token from @armory/tokens
const usdcToken = TOKENS.USDC_BASE;

// Or retrieve registered token
const token = getCustomToken(8453, "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913");

const result = await verifyPayment(payload, {
  walletClient,
  publicClient,
  nonceTracker,
  acceptedNetworks: ['ethereum', 'polygon'],
  token: usdcToken, // Use token object instead of individual fields
});

// Legacy approach (still supported)
const result = await verifyPayment(payload, {
  walletClient,
  publicClient,
  nonceTracker,
  acceptedNetworks: ['ethereum', 'polygon'],
  contractAddress: '0x...', // Individual fields
  network: 'base',
});
```

### Nonce Tracking

```typescript
const tracker = createNonceTracker()

// Check and reserve
await tracker.checkAndReserve(nonce, contractAddress, from)

// Mark used
await tracker.markUsed(nonce, contractAddress, from, txHash)
```

---

## File Structure

```
src/
├── queue/
│   ├── types.ts    # Queue interfaces
│   └── memory.ts   # In-memory queue implementation
├── nonce/
│   ├── types.ts    # Nonce tracker interfaces
│   └── memory.ts   # In-memory nonce tracker
├── verify.ts       # Payment verification logic
├── settle.ts       # On-chain settlement
├── server.ts       # Facilitator HTTP server
└── index.ts        # Main exports
```

---

## Dependencies

- **@armory/core**: Protocol types, configs, and token registry
- **@armory/tokens**: Pre-configured token objects (optional)
- **viem**: Ethereum client, wallet, contract calls
- **ioredis** (optional): Redis queue/nonce backend

---

## Implementation Notes

- **Settlement**: Calls USDC `transferWithAuthorization()` via Viem
- **Verification**: Checks signature, balance, nonce, validity window
- **Queue**: Memory default; Redis via optional dependency
- **Server**: Standalone HTTP server for settlement endpoints
- **Token objects**: Supports both token objects (recommended) and legacy individual fields
