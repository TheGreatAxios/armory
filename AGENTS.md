# Armory - Agent Guidelines

**Project Name**: Armory
**Domain**: x402 Payment Protocol (EIP-3009)
**Goal**: TypeScript libraries for crypto payments - enable server-to-client payments via HTTP headers

---

## Project Goals

1. **100% x402 v2 Compatibility** - Fully compatible with Coinbase x402 SDKs
   - Server middleware must accept payments from Coinbase clients
   - Client libraries must work with Coinbase servers
   - Test compatibility continuously - breaking changes block merges
2. **Easiest x402 library** - Simple, intuitive APIs for both clients and merchants
3. **Minimal dependencies** - Keep packages lightweight
4. **Developer experience** - Clear errors, flexible inputs, full TypeScript support

---

## Code Style

- **No comments** - Code should be self-documenting through clear naming
- **TypeScript strict mode** - No `any`, use proper typing
- **ES Modules** - Use `import { x } from 'y'` at top of files
- **No IIFE** - Use named functions
- **No dynamic imports** - All imports at compile time
- **Avoid closures** - Prefer explicit function parameters over captured variables
- **No OOP classes** - Prefer functional patterns
- **Modular exports** - Export functions individually

### TypeScript Rules

```typescript
// ✅ GOOD - Proper typing
interface PaymentPayload {
  chainId: number
  amount: string
  payTo: `0x${string}`
}

// ❌ BAD - any type
function process(data: any): any { /* ... */ }
```

### Code Patterns

```typescript
// ✅ GOOD - ESM at top, named function
import { foo } from 'bar'
import { baz } from 'qux'

function init() { /* ... */ }
init()

// ❌ BAD - IIFE
(function() { /* ... */ })()

// ❌ BAD - dynamic import
const foo = await import('bar')

// ❌ BAD - closure capturing variables
function createHandler() {
  const captured = 'state'
  return function() { /* uses captured */ }
}

// ✅ GOOD - explicit parameters
function handler(state: string) { /* uses state param */ }
```

---

## Package-Specific Guidelines

### @armory-sh/base (core)

- **x402 v2 types** - MUST match Coinbase spec exactly
- Encoding/decoding - MUST use exact x402 v2 wire format (Base64URL-encoded JSON)
  - NEVER change encoding without verifying x402 SDK compatibility
- EIP-712 typed data - EIP-3009 TransferWithAuthorization
- Network configs
- Token registry

### @armory-sh/tokens

- Pre-configured token objects
- Token registry integration

### Middleware Packages

- Accept payment headers
- Return payment response headers
- Decode and verify x402 payment signatures

### Client Packages

- Create payment requests
- Handle x402 headers
- Parse responses

---

## Protocol Reference

**IMPORTANT**: Armory implements the Coinbase x402 payment protocol (EIP-3009).
- Goal: 100% wire-format compatibility with Coinbase x402 SDKs
- All encoding/decoding MUST match x402 spec exactly

### Specification Links

- [x402 Spec v2](https://github.com/coinbase/x402/blob/main/specs/x402-specification-v2.md)
- [Transport: A2A](https://github.com/coinbase/x402/tree/main/specs/transports-v2/a2a.md)
- [Transport: HTTP](https://github.com/coinbase/x402/tree/main/specs/transports-v2/http.md)
- [Extensions](https://github.com/coinbase/x402/tree/main/specs/extensions)

### Headers

| Payment Header | Response Header |
|---------------|-----------------|
| `PAYMENT-SIGNATURE` | `PAYMENT-RESPONSE` |

### Supported Networks

- Ethereum (1)
- Base (8453)
- Base Sepolia (84532)
- SKALE Base (1187947933)
- SKALE Base Sepolia (324705682)
- Ethereum Sepolia (11155111)

### Supported Tokens

USDC, EURC, USDT, WBTC, WETH across supported networks

---

## Input Formats

**Networks** - Any format accepted:
```typescript
'base'              // name
8453                // chain ID
'eip155:8453'       // CAIP-2
```

**Tokens** - Any format accepted:
```typescript
'usdc'              // symbol (case-insensitive)
'0x8335...'         // EVM address
'eip155:8453/erc20:0x8335...'  // CAIP Asset ID
```

---

## Testing

- **NEVER skip tests** - Do not use `test.skip`, `describe.skip`, or `test.todo`
- All tests must run - if a test is broken, fix it or remove it

### Test Naming Convention

All tests must follow the naming convention:

```
[unit|<pkg-name>] - [<function>|<outcome>] - <description>
```

Examples:
- `[unit|base] - [getToken|success] - retrieves token by chainId and address`
- `[unit|client-viem] - [createX402Client|success] - creates client with account`
- `[e2e|payment-flow] - [fullFlow|success] - completes full payment flow`

**Unit Tests** (`[unit|...]`):
- Prefix with `[unit|<package>]`
- Second bracket: `[<function-name>|<outcome>]`
- Description after

**E2E Tests** (`[e2e|...]`):
- Prefix with `[e2e|<context>]`
- Second bracket: `[<function-name>|<outcome>]`
- Description after
- Keep existing describe names and add prefix

```typescript
// ✅ GOOD
describe("[unit|base]: Network Resolution", () => { ... })
describe("[e2e|full-flow]: Complete Payment Flow", () => { ... })

// ❌ BAD
describe("Network Resolution", () => { ... })
describe("[base]: createX402Client", () => { ... })
```

This helps LLMs identify which package a test belongs to and what outcome is tested.

### Unit Tests

- Use basic mocked tests - no external internet calls
- Mock blockchain calls, HTTP requests, and external services
- Keep tests simple and fast

```bash
# Run all tests
bun test

# Run specific package tests
bun test packages/base

# Watch mode
bun test --watch
```

### E2E Tests

- Use 3rd party payment facilitators for integration testing
- No mocking in e2e tests - test real flows
- **Cross-SDK Compatibility**: Test against Coinbase x402 SDKs
  - Server middleware must accept Coinbase client payments
  - Client libraries must work with Coinbase servers
  - All compatibility tests must pass

```bash
# Run e2e tests
bun test:e2e
```

---

## Debugging & Fixing Build/Test Errors

**ALWAYS use task lists for any multi-step work.** Create a todolist before starting changes.

When fixing build or test failures:

1. **Navigate to the specific package** - Go to the package directory once the issue location is known
2. **Reproduce the error** - Run `bun run build` or `bun run test` to see the actual problem
3. **Create a task list** - Document what needs to be fixed
4. **Fix the specific issue** - Make minimal, targeted changes
5. **Re-run the command** - Verify the fix works
6. **Repeat until clean** - Continue until build/tests pass

**Critical**: Do not add slop or change unrelated items. Fix only what's broken.

---

## Publishing

Uses Changesets for versioning:

```bash
bun run changeset    # Create changeset
bun run ci:version   # Version packages
bun run ci:publish   # Publish to npm
```

---

## Key Conventions

1. **Package naming**: Use `@armory-sh/` scope for npm
2. **Exports**: Use both `bun` (for dev) and `default` (for dist) in exports
3. **Versioning**: All packages share same version via changesets
4. **Workspace**: Uses `workspace:*` for internal dependencies
