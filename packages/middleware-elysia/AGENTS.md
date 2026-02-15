# @armory-sh/middleware-elysia

HTTP middleware for Elysia to accept x402 payments.

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

```bash
bun run build    # Build dist/
bun run test    # Run tests
```

---

## Testing

- **NEVER skip tests** - Do not use `test.skip`, `describe.skip`, or `test.todo`
