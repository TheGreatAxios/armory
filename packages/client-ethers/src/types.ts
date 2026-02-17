import type { CustomToken } from "@armory-sh/base";
import type { Provider, Signer } from "ethers";

// Re-export ethers types
export type { Signer, Provider };

// Re-export errors from errors.ts
export {
  AuthorizationError,
  PaymentError,
  ProviderRequiredError,
  SignerRequiredError,
  SigningError,
  X402ClientError,
} from "./errors";

/** Token configuration - can use pre-configured tokens from @armory-sh/tokens */
export type Token = CustomToken;

export interface X402ClientConfig {
  protocolVersion?: 1 | 2 | "auto";
  defaultExpiry?: number;
  nonceGenerator?: () => string;
  network?: string;
  usdcAddress?: `0x${string}`;
  rpcUrl?: string;
  /** Pre-configured token object (overrides individual fields below) */
  token?: Token;
  /** Override EIP-712 domain name for custom tokens */
  domainName?: string;
  /** Override EIP-712 domain version for custom tokens */
  domainVersion?: string;
}

export interface SignerClientConfig extends X402ClientConfig {
  signer: Signer;
}

export interface ProviderClientConfig extends X402ClientConfig {
  provider: Provider;
  signer?: never;
}

export type ClientConfig = SignerClientConfig | ProviderClientConfig;

export interface X402TransportConfig {
  baseURL?: string;
  headers?: Record<string, string>;
  timeout?: number;
  autoPay?: boolean;
  maxRetries?: number;
  retryDelay?: number;
  onPaymentRequired?: (requirements: unknown) => boolean | Promise<boolean>;
  onPaymentSuccess?: (settlement: unknown) => void;
  onPaymentError?: (error: Error) => void;
}

export interface X402RequestInit extends Omit<RequestInit, "headers"> {
  headers?: Record<string, string> | Headers;
  skipAutoPay?: boolean;
  forceProtocolVersion?: 1 | 2;
}

export interface TransferWithAuthorizationParams {
  from: `0x${string}`;
  to: `0x${string}`;
  value: bigint | number;
  validAfter: bigint | number;
  validBefore: bigint | number;
  nonce: `0x${string}`;
}

export interface EIP712Domain {
  name: string;
  version: string;
  chainId: number;
  verifyingContract: `0x${string}`;
}
