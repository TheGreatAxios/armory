# X-402 Protocol Libraries

- **Project**: armory/x402
- **Goal**: TypeScript libraries for X-402 payment protocol (EIP-3009)

---

## Overview

X-402 is a payment protocol built on EIP-3009 (transferWithAuthorization). Enables server-to-client payments via HTTP headers.

**Protocol Versions:**
- **v1**: `X-PAYMENT` header (legacy)
- **v2**: `PAYMENT-SIGNATURE` header (CAIP-2/CAIP-10 compliant)

---

## Monorepo Structure

```
packages/
├── core/           # Protocol types, encoding, EIP-712, network configs
├── tokens/         # Pre-configured token objects
├── facilitator/    # Server-side payment settlement & verification
├── middleware/     # HTTP middleware (Express, Hono, Bun, Elysia)
├── client-viem/    # Viem-based payment client
├── client-ethers/  # Ethers.js v6 payment client
└── client-web3/    # Web3.js payment client
```

**Workspace**: Bun with `workspace:*` protocol dependencies

---

## Global Commands

```bash
# Install all workspace dependencies
bun install

# Typecheck all packages
bun run check-types  # (if configured)

# Run all tests
bun test

# Build all packages
bun run build
```

---

## Key Technologies

- **Runtime**: Bun
- **Language**: TypeScript (strict mode)
- **Ethereum**: Viem v2
- **Protocol**: EIP-3009 (USDC transferWithAuthorization)
- **Testing**: Bun test runner

---

## Protocol Reference

### EIP-3009 transferWithAuthorization

Allows off-chain authorization for token transfers:

```typescript
interface TransferWithAuthorization {
  from: Address
  to: Address
  value: bigint
  validAfter: uint256
  validBefore: uint256
  nonce: bytes32
  signature: bytes
}
```

### Headers

| Version | Payment Header | Response Header |
|---------|---------------|-----------------|
| v1 | `X-PAYMENT` | `X-PAYMENT-RESPONSE` |
| v2 | `PAYMENT-SIGNATURE` | `PAYMENT-RESPONSE` |

### Payment Flow

1. Client creates payment payload (EIP-712 signed)
2. Client sends request with payment header
3. Server verifies signature, balance, nonce, validity
4. Server settles payment via USDC contract
5. Server responds with settlement header (txHash)

---

## Package-Specific Guidelines

See package-specific AGENTS.md files:
- `packages/core/AGENTS.md`
- `packages/tokens/AGENTS.md`
- `packages/facilitator/AGENTS.md`
- `packages/middleware/AGENTS.md`
- `packages/client-viem/AGENTS.md`
- `packages/client-ethers/AGENTS.md`
- `packages/client-web3/AGENTS.md`

---

## Code Standards

- **Full type safety** - No `any`, use `unknown` with guards
- **ES Modules only** - No CommonJS
- **Functional over OOP** - Small functions, clear naming
- **No IIFE** - Named functions or top-level statements
- **Test first** - Write tests for new features

---

## Token Objects

### Using Token Objects (Recommended)

The `@armory/tokens` package provides pre-configured token objects for common ERC-20 tokens:

```typescript
import { TOKENS, registerToken } from "@armory/tokens";
import { registerToken as registerCoreToken } from "@armory/core";

// Use pre-configured tokens
const usdcBase = TOKENS.USDC_BASE;

// Register for use with protocol
registerCoreToken(usdcBase);

// Create payment with token object
const payment = await client.createPayment({
  token: usdcBase,
  amount: "1.5",
  payToAddress,
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

### Legacy Individual Fields

```typescript
// Legacy approach (still supported)
const payment = await client.createPayment(
  "1.5",        // amount in USDC
  payToAddress, // recipient address
  usdcAddress,  // USDC contract address
  8453          // chain ID (Base)
);
```

## Network Support

Supported networks (via `@armory/core`):

- **Ethereum**: Mainnet, Sepolia
- **Polygon**: Mainnet, Amoy
- **Optimism**: Mainnet, Sepolia
- **Arbitrum**: Mainnet, Sepolia
- **Base**: Mainnet, Sepolia

Pre-configured tokens available via `@armory/tokens` package.

---

## External References

- **EIP-3009**: https://eips.ethereum.org/EIPS/eip-3009
- **Viem Docs**: https://viem.sh
- **CAIP Standards**: https://chainagnostic.org
- **USDC Contracts**: https://github.com/centre-devs/centre-tokens
