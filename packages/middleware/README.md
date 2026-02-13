# @armory-sh/middleware

> **DEPRECATED**: Use framework-specific packages directly for smaller bundles and better type inference:
> - `@armory-sh/middleware-bun`
> - `@armory-sh/middleware-express`
> - `@armory-sh/middleware-hono`
> - `@armory-sh/middleware-elysia`

Barrel package for Armory middleware. Re-exports all framework-specific packages:

## Install

```bash
bun add @armory-sh/middleware
```

## Use

```typescript
// All exports from framework packages are available
import {
  createBunMiddleware,
  paymentMiddleware,  // Express
  acceptPaymentsViaArmory,  // Hono
  paymentMiddleware,  // Elysia
} from '@armory-sh/middleware'
```

For framework-specific usage, see individual packages:
- Bun: `@armory-sh/middleware-bun`
- Express: `@armory-sh/middleware-express`
- Hono: `@armory-sh/middleware-hono`
- Elysia: `@armory-sh/middleware-elysia`

---

MIT License | Sawyer Cutler 2026 | Provided "AS IS" without warranty
