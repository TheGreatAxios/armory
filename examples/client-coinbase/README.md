# X-402 Client Example (Coinbase Wallet SDK)

This directory contains an example implementation of X-402 payment client using the Coinbase Wallet SDK for browser-based applications.

## Example

### coinbase-wallet.ts

Demonstrates how to integrate X-402 payments with the Coinbase Wallet SDK. Shows how to:
- Initialize the Coinbase Wallet SDK
- Connect a user's wallet
- Sign EIP-712 typed data (EIP-3009 TransferWithAuthorization)
- Create payment payloads with real signatures
- Verify and settle payments

## Browser Usage

This example is designed for browser environments. To use it:

1. Create an HTML file to load the example:

```html
<!DOCTYPE html>
<html>
<head>
  <title>X-402 Coinbase Wallet Example</title>
</head>
<body>
  <h1>X-402 Payment with Coinbase Wallet</h1>
  <div id="app"></div>
  <script type="module" src="./coinbase-wallet.ts"></script>
</body>
</html>
```

2. Serve the file with a local server:

```bash
bun --hot coinbase-wallet.ts
```

Or use a simple HTTP server:

```bash
python3 -m http.server 8000
```

3. Open the page in a browser with Coinbase Wallet extension installed

## Configuration

### Application Metadata

Update the app metadata in the code to match your application:

```typescript
const appMetadata = {
  name: "Your App Name",
  iconUrl: "https://your-domain.com/icon.png",
  description: "Your app description",
};
```

### Network Configuration

The example is configured for Base Mainnet by default:
- Chain ID: 8453
- USDC Address: `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`
- RPC URL: `https://mainnet.base.org`

To use a different network, modify the constants in the source file.

## Dependencies

- `@armory/base`: Core X-402 protocol types and utilities
- `@coinbase/wallet-sdk`: Coinbase Wallet SDK for browser integration

## Notes

- This example requires a browser environment with the Coinbase Wallet extension or mobile app
- For Node.js/server environments, use the ethers or viem examples instead
- The Coinbase Wallet SDK provides a seamless user experience for Coinbase Wallet users
- Users will be prompted to connect their wallet and sign the payment authorization

## Security Considerations

- Always verify the payment details before requesting a signature from the user
- Display clear information about what the user is signing
- Use proper error handling for wallet connection failures
- Never request signatures without user intent (clear button clicks)
