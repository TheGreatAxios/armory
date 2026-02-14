# @armory-sh/middleware

Unified HTTP middleware export. Re-exports all framework-specific middleware packages.

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

## Packages

This package re-exports:

- `@armory-sh/middleware-bun` - Bun runtime middleware
- `@armory-sh/middleware-express` - Express middleware
- `@armory-sh/middleware-hono` - Hono middleware
- `@armory-sh/middleware-elysia` - Elysia middleware

---

## Usage

```typescript
// Unified import - auto-detects framework
import { acceptPaymentsViaArmory } from "@armory-sh/middleware"
```

See individual package READMEs for framework-specific usage.

---

## Testing

- **NEVER skip tests** - Do not use `test.skip`, `describe.skip`, or `test.todo`
