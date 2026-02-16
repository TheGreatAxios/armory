# armory-cli

Armory x402 SDK — CLI tool to scaffold payment-enabled apps, query networks/tokens, and verify endpoints.

[Documentation](https://armory.sh) | [License](LICENSE)

## Installation

```bash
bun add -g armory-cli
```

## Why Armory?

Armory enables HTTP API payments via EIP-3009 `transferWithAuthorization`. Scaffold full payment servers and clients in seconds.

## Commands

### `armory create <template> [name]`

Scaffold a new x402 payment-enabled project.

**Server Templates:**
- `bun-server` — Bun server with payment middleware
- `express-server` — Express v5 server
- `hono-server` — Hono server with extension support
- `elysia-server` — Elysia/Bun server
- `next-server` — Next.js middleware

**Client Templates:**
- `viem-client` — Viem x402 client
- `ethers-client` — Ethers.js v6 client
- `web3-client` — Web3.js client

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

## License

MIT © [Sawyer Cutler](https://github.com/TheGreatAxios/armory)
