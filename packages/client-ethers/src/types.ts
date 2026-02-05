import type { Signer, Provider } from "ethers";
import type { CustomToken } from "@armory/core";

/** Token configuration - can use pre-configured tokens from @armory/tokens */
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
  nonce: bigint | number;
}

export interface EIP712Domain {
  name: string;
  version: string;
  chainId: number;
  verifyingContract: `0x${string}`;
}

export class X402ClientError extends Error {
  override readonly cause?: unknown;

  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = "X402ClientError";
    this.cause = cause;
  }
}

export class SignerRequiredError extends X402ClientError {
  constructor(message = "Signer is required for this operation") {
    super(message);
    this.name = "SignerRequiredError";
  }
}

export class AuthorizationError extends X402ClientError {
  constructor(message: string, cause?: unknown) {
    super(`Authorization failed: ${message}`, cause);
    this.name = "AuthorizationError";
  }
}

export class ProviderRequiredError extends X402ClientError {
  constructor(message = "Provider is required for this operation") {
    super(message);
    this.name = "ProviderRequiredError";
  }
}
