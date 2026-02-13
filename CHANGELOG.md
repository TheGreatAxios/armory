# Changelog

All notable changes to the Armory SDK will be documented in this file.

## [0.2.1] - 2025-02-12

### @armory-sh/base

- **Fixed**: `detectPaymentVersion` now properly detects legacy V1/V2 payment formats alongside x402 format
- **Added**: Fallback handling for undecodable payloads in version detection

### @armory-sh/facilitator

- **Added**: Missing `cleanup()` method to `MemoryNonceTracker` class
- **Fixed**: `close()` method now preserves nonce data for post-close `isUsed()` checks

### @armory-sh/middleware

- **Fixed**: `createPaymentRequirements` now defaults to version 1
- **Fixed**: `createPaymentRequiredHeaders` base64-encodes V2 requirements
- **Fixed**: `createSettlementHeaders` handles both x402 and legacy settlement formats
- **Added**: Legacy payload type guards and support functions
- **Added**: Proper type exports for backward compatibility

### Test Coverage

- All 322 tests now pass (was 318 passing, 4 failing)

## [0.2.0] - Previous Release

### Coinbase x402 Protocol Support

- Added full support for Coinbase x402 protocol
- New `@armory-sh/base` types in `types/x402.ts` and `encoding/x402.ts`
- Payment payload encoding/decoding with `safeBase64Encode`/`safeBase64Decode`
- Settlement response encoding compatible with Coinbase facilitators
- Cross-chain payment support (Base, Ethereum, Polygon, Arbitrum, Optimism)
- EIP-3009 TransferWithAuthorization support

### Client Libraries

- `@armory-sh/client-viem` - Viem integration
- `@armory-sh/client-ethers` - Ethers.js integration
- `@armory-sh/client-web3` - Web3.js integration

### Facilitator

- Payment verification with `verifyX402Payment`
- Settlement with `settleX402`
- Nonce tracking (memory and Redis backends)

### Middleware

- Bun middleware with `createBunMiddleware`
- Payment requirements generation
- Settlement response headers
