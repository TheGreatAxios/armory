# X-402 Faremeter Adapter Example

This directory contains an example adapter that makes faremeter-compatible clients work with the X-402 protocol.

## Overview

The `FaremeterAdapter` class provides bidirectional conversion between:
- **Faremeter format**: A hypothetical payment protocol with its own request/response structure
- **X-402 format**: The standardized payment protocol

## Example

### faremeter-adapter.ts

Demonstrates how to:
- Convert faremeter payment requests to X-402 payment payloads
- Convert faremeter requirements to X-402 requirements
- Convert X-402 responses back to faremeter format
- Verify and settle payments through the adapter

**Run:**
```bash
bun run faremeter-adapter
```

## Adapter Pattern

The adapter implements the following conversions:

```typescript
// Faremeter -> X-402
FaremeterPaymentRequest → PaymentPayloadV2
FaremeterPaymentRequest → PaymentRequirementsV2

// X-402 -> Faremeter
SettlementResponse → FaremeterPaymentResponse
```

## Faremeter Protocol Structure

### Request Format

```typescript
interface FaremeterPaymentRequest {
  payer: string;           // Payer wallet address
  recipient: string;       // Recipient address
  amount: string;          // Amount in smallest unit
  currency: string;        // Currency code (USD, EUR, etc.)
  timestamp: number;       // Creation timestamp
  reference: string;       // Unique payment reference
  expires_in: number;      // Expiration in seconds
  signature: {             // ECDSA signature
    r: string;
    s: string;
    v: number;
  };
}
```

### Response Format

```typescript
interface FaremeterPaymentResponse {
  success: boolean;
  transaction_id?: string;
  error?: string;
}
```

## Currency Mapping

The adapter includes a currency-to-network mapping:

| Currency | Network | USDC Address |
|----------|---------|--------------|
| USD      | Base (8453) | 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 |
| EUR      | Ethereum (1) | 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48 |

Extend the `CURRENCY_ASSET_MAP` to support additional currencies.

## Usage

### Basic Usage

```typescript
import { FaremeterAdapter } from "./faremeter-adapter";

// Convert faremeter request to X-402
const x402Payload = FaremeterAdapter.toX402PaymentPayload(faremeterRequest);
const x402Requirements = FaremeterAdapter.toX402PaymentRequirements(faremeterRequest);

// Convert X-402 response back to faremeter
const faremeterResponse = FaremeterAdapter.fromX402Response(x402Response);
```

### With Helper Functions

```typescript
import { verifyFaremeterPayment, settleFaremeterPayment } from "./faremeter-adapter";

// Verify a faremeter payment
const result = await verifyFaremeterPayment(faremeterRequest);

// Settle a faremeter payment
const settlement = await settleFaremeterPayment(faremeterRequest);
```

## Configuration

### Environment Variables

- `FACILITATOR_URL`: URL of the X-402 facilitator server (default: `http://localhost:3000`)

### Custom Currency Mapping

To add support for more currencies:

```typescript
const CURRENCY_ASSET_MAP: Record<string, { chainId: number; usdcAddress: string }> = {
  // ... existing currencies
  GBP: {
    chainId: 137, // Polygon
    usdcAddress: "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174",
  },
};
```

## Dependencies

- `@armory/base`: Core X-402 protocol types and utilities

## Extending the Adapter

To adapt a different payment protocol:

1. Define the source protocol's types
2. Create conversion functions for:
   - Request → X-402 Payload
   - Request → X-402 Requirements
   - X-402 Response → Response
3. Implement helper functions for verification/settlement
4. Add any protocol-specific mappings (currency, network, etc.)

## Notes

- This example uses mock signatures for demonstration
- In production, ensure proper signature validation
- The adapter pattern allows legacy systems to adopt X-402 without major refactoring
- Consider adding error handling for unsupported currencies or networks
- The adapter can be extended to support bidirectional signature conversion if needed
