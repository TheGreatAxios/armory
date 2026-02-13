# @armory-sh/middleware

## 0.3.0

### Minor Changes

- Add multi-price support - configure different amounts per network, token, or facilitator.

## 0.2.2

### Patch Changes

- 49e6a71: This release includes critical fixes for Coinbase x402 compatibility, type safety, and test coverage.

  ## @armory-sh/base

  - **Fixed**: `detectPaymentVersion` in `encoding/x402.ts` now properly detects legacy payment formats
    - Legacy V1: Uses `X-PAYMENT` header with base64-encoded JSON
    - Legacy V2: Uses `PAYMENT-SIGNATURE` header
    - x402 format: Uses `X-PAYMENT` header with `x402Version` property
  - **Added**: Fallback handling for undecodable payloads in version detection

  ## @armory-sh/facilitator

  - **Added**: Missing `cleanup()` method to `MemoryNonceTracker` class
    - Removes expired nonces based on TTL configuration
    - Safe to call multiple times without side effects
  - **Fixed**: `close()` method no longer clears nonce data
    - Nonce tracking data is preserved after close for `isUsed()` checks
    - `close()` is now a no-op for memory tracker (no timer to stop)

  ## @armory-sh/middleware

  - **Fixed**: `createPaymentRequirements` now defaults to version 1 (was version 2)
  - **Fixed**: `createPaymentRequiredHeaders` now base64-encodes V2 requirements (matches V1 behavior)
  - **Fixed**: `createSettlementHeaders` properly handles both x402 and legacy settlement response formats
    - Correctly detects `success` (V1) vs `status` (V2) properties
    - Extracts `txHash` from both legacy and x402 formats
  - **Added**: `LegacyPaymentPayloadV1` and `LegacyPaymentPayloadV2` interfaces in payment-utils
  - **Added**: `isLegacyV1()` and `isLegacyV2()` type guard functions
  - **Added**: `AnyPaymentPayload` union type for all payload formats
  - **Fixed**: `bun.ts` Network type - defined locally since not exported from base package
  - **Added**: Proper type exports for `SettlementResponse` and `PaymentRequirements` unions

  ## Test Coverage

  - All 322 tests now pass
  - Previously failing tests in `core`, `facilitator`, and `middleware` packages now pass

- Updated dependencies [49e6a71]
  - @armory-sh/base@0.2.2
  - @armory-sh/facilitator@0.2.2

## 0.2.0

### Minor Changes

- Initial stable release with full TypeScript build support.

  - Fixed all type exports and imports across packages
  - Added DOM compatibility for client libraries (ethers, viem, web3)
  - Configured Bun-specific types for facilitator server
  - Removed framework-specific integrations to separate directory
  - All 8 packages building successfully with type declarations

### Patch Changes

- Updated dependencies
  - @armory-sh/base@0.2.0
  - @armory-sh/facilitator@0.2.0
