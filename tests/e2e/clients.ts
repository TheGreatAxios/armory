/**
 * E2E Test Client Wrappers
 *
 * Provides wrappers for Faremeter and x402 clients for testing.
 */

import { privateKeyToAccount } from "viem/accounts";

// ============================================================================
// Configuration Types
// ============================================================================

export interface TestClient {
  fetch: typeof fetch;
}

export interface ClientConfig {
  baseUrl: string;
  privateKey: `0x${string}`;
  chainId: number;
}

// ============================================================================
// Faremeter Client Wrapper
// ============================================================================

export const createFaremeterClient = async (config: ClientConfig): Promise<TestClient> => {
  const { wrapFetchWithPaymentFromConfig } = await import("@faremeter/fetch");
  const { createPaymentHandler } = await import("@faremeter/payment-evm");

  const account = privateKeyToAccount(config.privateKey);
  const wallet = { ...account, chain: { id: config.chainId } };

  const fetchWithPayment = wrapFetchWithPaymentFromConfig(fetch, { handlers: [createPaymentHandler(wallet)] });

  return { fetch: fetchWithPayment };
};

export const createX402Client = async (config: ClientConfig): Promise<TestClient> => {
  const { wrapFetchWithPaymentFromConfig } = await import("@x402/fetch");
  const { ExactEvmScheme } = await import("@x402/evm");

  const account = privateKeyToAccount(config.privateKey);

  const fetchWithPayment = wrapFetchWithPaymentFromConfig(fetch, {
    schemes: [{ network: `eip155:${config.chainId}`, client: new ExactEvmScheme(account) }],
  });

  return { fetch: fetchWithPayment };
};
