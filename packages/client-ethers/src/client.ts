/**
 * X402 Client Factory for Ethers
 *
 * Creates a configured client instance for making X-402 payments
 */

import type { Provider, Signer } from "ethers";
import { SignerRequiredError } from "./errors";
import { createX402Transport } from "./transport";
import type {
  ClientConfig,
  ProviderClientConfig,
  SignerClientConfig,
  X402ClientConfig,
  X402RequestInit,
} from "./types";

/**
 * X402 Client instance
 * Provides a high-level API for making X-402 authenticated requests
 */
export interface X402Client {
  /**
   * Make a GET request
   */
  get(url: string, init?: X402RequestInit): Promise<Response>;

  /**
   * Make a POST request
   */
  post(url: string, body?: unknown, init?: X402RequestInit): Promise<Response>;

  /**
   * Make a PUT request
   */
  put(url: string, body?: unknown, init?: X402RequestInit): Promise<Response>;

  /**
   * Make a DELETE request
   */
  del(url: string, init?: X402RequestInit): Promise<Response>;

  /**
   * Make a PATCH request
   */
  patch(url: string, body?: unknown, init?: X402RequestInit): Promise<Response>;

  /**
   * Set the signer for payment signing
   */
  setSigner(signer: Signer): void;

  /**
   * Get the current signer
   */
  getSigner(): Signer | undefined;
}

export type { X402RequestInit } from "./types";

/**
 * Create an X402 client
 *
 * @param config - Client configuration
 * @returns Configured X402 client
 */
export function createX402Client(
  config: X402ClientConfig & SignerClientConfig & { signer: Signer },
): X402Client;

export function createX402Client(
  config: X402ClientConfig & ProviderClientConfig,
): X402Client;

export function createX402Client(config: ClientConfig): X402Client {
  const transport = createX402Transport(undefined);

  if ("signer" in config && config.signer) {
    transport.setSigner(config.signer);
  } else if ("provider" in config && config.provider) {
    // Provider-based config - signer will be set via provider
    // The provider should have a signer accessible
    const provider = config.provider as Provider & { getSigner?: () => Signer };
    if (provider.getSigner) {
      try {
        const signer = provider.getSigner();
        if (signer) {
          transport.setSigner(signer);
        }
      } catch {
        // Provider might not have a signer ready yet
      }
    }
  } else {
    throw new SignerRequiredError(
      "Either 'signer' or 'provider' with getSigner() must be provided",
    );
  }

  return {
    get: (url, init) => transport.get(url, init),
    post: (url, body, init) => transport.post(url, body, init),
    put: (url, body, init) => transport.put(url, body, init),
    del: (url, init) => transport.del(url, init),
    patch: (url, body, init) => transport.patch(url, body, init),
    setSigner: (signer: Signer) => transport.setSigner(signer),
    getSigner: () => transport.getSigner(),
  };
}
