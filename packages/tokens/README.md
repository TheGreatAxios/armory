# @armory-sh/tokens

> **⚠️ DEPRECATED** - This package is deprecated and will be removed in v3.0.0

## Migration

Import token constants from `@armory-sh/base` instead:

```typescript
// Old (deprecated)
import { TOKENS, USDC_BASE } from "@armory-sh/tokens";

// New
import { TOKENS, USDC_BASE } from "@armory-sh/base";
```

### Available Tokens

All token constants are now exported from `@armory-sh/base`:

- `TOKENS` - Collection of all tokens
- `USDC_BASE` - USDC on Base
- `EURC_BASE` - EURC on Base
- `USDC_BASE_SEPOLIA` - USDC on Base Sepolia
- `USDC_SKALE_BASE` - USDC on SKALE Base
- `USDT_SKALE_BASE` - USDT on SKALE Base
- `WBTC_SKALE_BASE` - WBTC on SKALE Base
- `WETH_SKALE_BASE` - WETH on SKALE Base
- `SKL_SKALE_BASE` - SKL on SKALE Base
- `USDC_SKALE_BASE_SEPOLIA` - USDC on SKALE Base Sepolia
- `USDT_SKALE_BASE_SEPOLIA` - USDT on SKALE Base Sepolia
- `WBTC_SKALE_BASE_SEPOLIA` - WBTC on SKALE Base Sepolia
- `WETH_SKALE_BASE_SEPOLIA` - WETH on SKALE Base Sepolia
- `SKL_SKALE_BASE_SEPOLIA` - SKL on SKALE Base Sepolia

### Helper Functions

```typescript
import {
  getToken,
  getAllTokens,
  getTokensBySymbol,
  getTokensByChain,
  getUSDCTokens,
  getEURCTokens,
  getSKLTokens,
  getUSDTokens,
  getWBTCTokens,
  getWETHTokens,
} from "@armory-sh/base";
```
