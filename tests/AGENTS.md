# Test Suite Guidelines

## Strict Rules

**NO SKIPPING TESTS** - This project does NOT use:

- `test.skip`
- `describe.skip`
- `test.todo`
- `test.skipUnless` (Bun-specific)
- `test.skipIf` (Bun-specific)
- Any conditional skip logic

### Why?

All tests must run in CI/CD. If a test is broken:
1. Fix it
2. Remove it
3. Document why it was removed (commit message)

Never commit skipped tests.

## Unit Tests

```bash
bun test                 # All unit tests
bun test packages/core   # Package-specific
```

**Rules:**
- Mock external services (no internet calls)
- Mock blockchain calls
- Fast execution (<1s per test)

## E2E Tests

```bash
bun test:e2e
```

**Rules:**
- Use 3rd party facilitator for integration
- No mocking - test real flows
- All tests must pass on every run
