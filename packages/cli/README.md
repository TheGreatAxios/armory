# armory-cli

CLI for the Armory x402 payment protocol. Scaffold apps, query networks/tokens, and verify endpoints.

## Install

```bash
bun add -g armory-cli
# or
npm install -g armory-cli
```

## Commands

### `armory create <template> [name]`

Scaffold a new x402 payment-enabled project.

**Server Templates:**
- `bun-server` - Bun server with payment middleware
- `express-server` - Express v5 server
- `hono-server` - Hono server with extension support
- `elysia-server` - Elysia/Bun server
- `next-server` - Next.js middleware

**Client Templates:**
- `viem-client` - Viem x402 client
- `ethers-client` - Ethers.js v6 client
- `web3-client` - Web3.js client

**Legacy:**
- `facilitator` - Payment verification server (deprecated)

```bash
armory create bun-server my-api
armory create hono-server my-hono-api
armory create viem-client my-client
```

### `armory networks`

List supported blockchain networks.

```bash
armory networks              # All networks
armory networks --mainnet    # Mainnets only
armory networks --testnet    # Testnets only
```

### `armory tokens [network]`

List supported tokens.

```bash
armory tokens           # All tokens
armory tokens base      # Tokens on Base
armory tokens 8453      # By chain ID
```

### `armory validate <type> <value>`

Validate a network or token identifier.

```bash
armory validate network base
armory validate network 8453
armory validate token usdc
armory validate token 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
```

### `armory extensions`

List available x402 protocol extensions.

```bash
armory extensions
armory ext
```

### `armory verify <url>`

Check x402 payment headers on an endpoint.

```bash
armory verify https://api.example.com/data
armory inspect https://api.example.com/data
```

## Examples

```bash
# Create a payment server
armory create bun-server my-payment-api
cd my-payment-api
bun install
bun run dev

# In another terminal, create a client
armory create viem-client my-client
cd my-client
bun install
PRIVATE_KEY=0x... bun run dev

# Check available networks and tokens
armory networks
armory tokens base

# Verify an endpoint
armory verify http://localhost:3000/api/data
```

## Supported Networks

| Network | Chain ID |
|---------|----------|
| Ethereum | 1 |
| Base | 8453 |
| Base Sepolia | 84532 |
| SKALE Base | 1187947933 |
| SKALE Base Sepolia | 324705682 |
| Ethereum Sepolia | 11155111 |

## Supported Tokens

USDC, EURC, USDT, WBTC, WETH, SKL across supported networks.

---

MIT License | Sawyer Cutler 2026 | Provided "AS IS" without warranty
