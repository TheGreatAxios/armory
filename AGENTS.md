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

## Package Architecture & Decision Flow

**Primary Rule**: Logic shared across implementations belongs in `@armory-sh/base`.

### Middleware Changes

1. **Start in base** - All middleware logic should be implemented in `@armory-sh/base` first
2. **Apply everywhere** - Once working in base, port to all middleware packages:
   - `@armory-sh/middleware-hono`
   - `@armory-sh/middleware-cloudflare`
   - `@armory-sh/middleware-express`
   - `@armory-sh/middleware-fastify`
   - `@armory-sh/middleware-next`
   - `@armory-sh/middleware-remix`
   - `@armory-sh/middleware-vercel`

### Client Changes

1. **Start in base** - All client logic should be implemented in `@armory-sh/base` first
2. **Hook runtime in base** - Shared hook lifecycle/types live in base and are reused by all clients
3. **Reusable presets in client-hooks** - Keep reusable preference/logger hooks in `@armory-sh/client-hooks` (optional package)
4. **Apply everywhere** - Once working in base, port to all client packages:
   - `@armory-sh/client-viem`
   - `@armory-sh/client-ethers`
   - `@armory-sh/client-walletconnect`
   - `@armory-sh/client-coinbase-wallet-sdk`
   - `@armory-sh/client-sui`
   - `@armory-sh/client-svm`

### Framework-Specific Exceptions

Only add framework-specific code directly in a package if:
- It requires unique framework APIs not available elsewhere
- The logic cannot be abstracted to `base` without losing functionality
- The feature is exclusive to that framework

---

## Package-Specific Guidelines

### @armory-sh/base (core)

- **Source of truth** - All shared middleware/client logic originates here
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

- Thin wrappers around base middleware logic
- Adapt base functions to framework-specific request/response patterns
- Accept payment headers
- Return payment response headers
- Decode and verify x402 payment signatures

### Client Packages

- Thin wrappers around base client logic
- Adapt base functions to wallet library patterns (viem, ethers, etc.)
- Create payment requests
- Handle x402 headers
- Parse responses (`PAYMENT-REQUIRED` with `accepts[]`, then selection)

---

## Protocol Reference

**IMPORTANT**: Armory implements the Coinbase x402 payment protocol (EIP-3009).
- Goal: 100% wire-format compatibility with Coinbase x402 SDKs
- All encoding/decoding MUST match x402 spec exactly
- **V2 only**: Do not add or keep V1/legacy protocol types, headers, decoding paths, or compatibility shims

### Specification Links

- [x402 Spec v2](https://github.com/coinbase/x402/blob/main/specs/x402-specification-v2.md)
- [Transport: A2A](https://github.com/coinbase/x402/tree/main/specs/transports-v2/a2a.md)
- [Transport: HTTP](https://github.com/coinbase/x402/tree/main/specs/transports-v2/http.md)
- [Extensions](https://github.com/coinbase/x402/tree/main/specs/extensions)

### Headers

| Challenge Header | Payment Header | Settlement Header |
|------------------|----------------|-------------------|
| `PAYMENT-REQUIRED` | `PAYMENT-SIGNATURE` | `PAYMENT-RESPONSE` |

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

**When stuck**: If you cannot figure out the issue, add temporary `console.log` debug statements to the relevant code paths, ask the human to run the code and share the output, then remove the logs after. Do not use `cat` to read files into random test files or create debug scripts.

**Critical**: Do not add slop or change unrelated items. Fix only what's broken.

---

## Publishing & Release Process

Armory uses **Changesets** for versioning and **GitHub Actions** for automated publishing.

### How It Works

1. **Local Development** - Use `workspace:*` for internal dependencies (resolved during publish)
2. **Changesets** - Track version bumps and changelogs via `.changeset/*.md` files
3. **Auto-Publish** - GitHub Actions publishes on merge to `main` or `staging`

### Release Channels

| Branch | npm Tag | Use Case | Trigger |
|--------|---------|----------|---------|
| `main` | `@latest` | Production releases | Push/merge to main |
| `staging` | `@beta` | Beta testing | Push/merge to staging |
| Local | `@alpha` | Local testing | Manual `bun run ci:release:alpha` |

### Making a Release

#### 1. Create a Changeset

After making changes to packages:

```bash
bun run changeset
```

You'll be prompted to:
- Select which packages changed
- Choose version bump type (patch/minor/major)
- Write a summary for the changelog

This creates a `.changeset/[name].md` file.

#### 2. Commit the Changeset

```bash
git add .
git commit -m "feat: add new payment feature"
git push
```

#### 3. Release via GitHub Actions

**For production (latest):**
- Create PR to `main` branch
- Merge the PR
- GitHub Actions automatically builds and publishes to `@latest`

**For beta releases:**
- Create PR to `staging` branch
- Merge the PR
- GitHub Actions automatically builds and publishes to `@beta`

#### 4. Install Specific Tags

```bash
# Latest (production)
npm install @armory-sh/client-viem

# Beta
npm install @armory-sh/client-viem@beta

# Alpha (must publish locally first)
npm install @armory-sh/client-viem@alpha
```

### Local Alpha Publishing

For local testing before pushing to remote:

```bash
# Full alpha release flow (creates changeset, versions, publishes @alpha)
bun run ci:release:alpha

# Or just publish existing versions as alpha
bun run ci:publish:alpha
```

### Important Notes

**Workspace Dependencies:**
- Packages use `workspace:*` in `package.json` for local development
- During publish, `bun publish` automatically resolves these to actual versions
- This is why we use `bun publish` directly instead of `changeset publish` (which doesn't understand Bun's workspace protocol)

**Running `bun update`:**
- After `changeset version` bumps versions, `bun update` is run to fix `bun.lockb`
- This ensures workspace dependencies resolve correctly during publish

**Version Bumping:**
- All packages share versions via changesets
- `updateInternalDependencies: "patch"` in changeset config bumps internal deps automatically

### Available Scripts

```bash
bun run changeset           # Interactive: create a changeset
bun run ci:version          # Bump versions based on changesets
bun run ci:publish          # Publish to @latest (production)
bun run ci:publish:beta     # Publish to @beta
bun run ci:publish:alpha    # Publish to @alpha
bun run ci:release          # Full release: changeset + version + publish
bun run ci:release:alpha    # Full alpha release locally
```

### GitHub Setup Requirements

**Required Secret:**
- `NPM_TOKEN` - Add to GitHub repo secrets (Settings → Secrets → Actions)
  - Create at https://www.npmjs.com/settings/tokens
  - Select "Automation" token type (required for CI/CD)

**Workflow File:**
- `.github/workflows/release.yml` - Handles auto-publish on push to main/staging

---

## Key Conventions

1. **Package naming**: Use `@armory-sh/` scope for npm
2. **Exports**: Use both `bun` (for dev) and `default` (for dist) in exports
3. **Versioning**: All packages share same version via changesets
4. **Workspace dependencies**: Use `workspace:*` in package.json - resolved to actual versions during publish by `bun publish`

---

# currentDate
Today's date is 2026-02-14.
