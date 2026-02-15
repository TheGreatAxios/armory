# @armory-sh/middleware-next

x402 payment middleware for Next.js App Router.

## Installation

```bash
bun add @armory-sh/middleware-next
```

## Usage

### Basic Setup

```typescript
// middleware.ts
import { paymentProxy, x402ResourceServer } from "@armory-sh/middleware-next";

const facilitatorClient = {
  async verify(headers: Headers) {
    // Implement verification logic
    return { success: true, payerAddress: "0x..." };
  }
};

const resourceServer = new x402ResourceServer(facilitatorClient);

export const proxy = paymentProxy(
  {
    "/api/protected": {
      accepts: {
        scheme: "exact",
        price: "1000000",
        network: "eip155:8453",
        payTo: "0x...",
      },
      description: "Access to protected API",
    },
  },
  resourceServer
);

export const config = { matcher: ["/api/protected/:path*"] };
```

### Per-Route Configuration

```typescript
export const proxy = paymentProxy(
  {
    "/api/basic": {
      accepts: { scheme: "exact", price: "1000000", network: "eip155:8453", payTo: "0x..." },
      description: "Basic tier",
    },
    "/api/premium": {
      accepts: { scheme: "exact", price: "50000000", network: "eip155:8453", payTo: "0x..." },
      description: "Premium tier",
    },
  },
  resourceServer
);
```

### With Facilitator Settlement

```typescript
const facilitatorClient = {
  async verify(headers: Headers) {
    const response = await fetch("https://facilitator.com/verify", {
      headers: Object.fromEntries(headers.entries()),
    });
    return response.json();
  },
  async settle(headers: Headers) {
    const response = await fetch("https://facilitator.com/settle", {
      method: "POST",
      headers: Object.fromEntries(headers.entries()),
    });
    return response.json();
  },
};
```

## Route Patterns

- Exact match: `/api/users`
- Wildcard: `/api/*` (matches `/api/users`, `/api/posts/123`)
- Next.js style: `/protected/:path*` (matches `/protected/foo/bar`)

## API

### `paymentProxy(routes, resourceServer)`

Creates a payment proxy handler for Next.js middleware.

**Parameters:**
- `routes`: Record mapping route patterns to payment config
- `resourceServer`: x402ResourceServer instance

**Returns:** Next.js middleware function

### `x402ResourceServer`

Registers and manages payment schemes.

**Methods:**
- `register(chainId, scheme)`: Register a payment scheme
- `getRequirements(chainId)`: Get requirements for a chain
- `getAllRequirements()`: Get all registered requirements
- `getFacilitator()`: Get the facilitator client
