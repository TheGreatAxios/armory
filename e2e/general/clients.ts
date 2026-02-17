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

export const createFaremeterClient = async (
  config: ClientConfig,
): Promise<TestClient> => {
  const { wrap } = await import("@faremeter/fetch");
  const { createPaymentHandler } = await import("@faremeter/payment-evm/exact");

  const account = privateKeyToAccount(config.privateKey);
  const wallet = { ...account, chain: { id: config.chainId } };

  const fetchWithPayment = wrap(fetch, {
    handlers: [createPaymentHandler(wallet)],
  });

  return { fetch: fetchWithPayment };
};

export const createX402Client = async (
  config: ClientConfig,
): Promise<TestClient> => {
  const { wrapFetchWithPayment, x402Client } = await import("@x402/fetch");
  const { ExactEvmScheme } = await import("@x402/evm");

  const account = privateKeyToAccount(config.privateKey);

  // Register for x402 version 2 with eip155:chainId network
  const client = new x402Client().register(
    `eip155:${config.chainId}`,
    new ExactEvmScheme(account),
    2,
  );
  const fetchWithPayment = wrapFetchWithPayment(fetch, client);

  return { fetch: fetchWithPayment };
};
