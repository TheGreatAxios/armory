/**
 * X402 Client Types - V2 Only
 */

import type { Address, Account, WalletClient, Transport } from "viem";
import type {
  PaymentPayloadV2,
  CustomToken,
} from "@armory-sh/base";
import type { ViemHookRegistry } from "./hooks";

export type X402Wallet =
  | { type: "account"; account: Account }
  | { type: "walletClient"; walletClient: WalletClient };

export type X402ProtocolVersion = 2;

/** Token configuration - can use pre-configured tokens from @armory-sh/tokens */
export type Token = CustomToken;

export interface X402ClientConfig {
  wallet: X402Wallet;
  version?: X402ProtocolVersion;
  defaultExpiry?: number;
  nonceGenerator?: () => string;
  debug?: boolean;
  /** Pre-configured token object (overrides individual fields below) */
  token?: Token;
  /** Override EIP-712 domain name for custom tokens */
  domainName?: string;
  /** Override EIP-712 domain version for custom tokens */
  domainVersion?: string;
  /** Extension hooks for handling protocol extensions */
  hooks?: ViemHookRegistry;
}

export interface X402Client {
  fetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
  getAddress(): Address;
  createPayment(
    amount: string,
    to: Address,
    contractAddress: Address,
    chainId: number,
    expiry?: number
  ): Promise<PaymentPayloadV2>;
  signPayment(
    payload: UnsignedPaymentPayload
  ): Promise<PaymentPayloadV2>;
}

export interface X402TransportConfig {
  wallet: X402Wallet;
  transport?: Transport;
  version?: X402ProtocolVersion;
  defaultExpiry?: number;
  nonceGenerator?: () => string;
  debug?: boolean;
  /** Pre-configured token object */
  token?: Token;
  /** Override EIP-712 domain name */
  domainName?: string;
  /** Override EIP-712 domain version */
  domainVersion?: string;
  /** Extension hooks for handling protocol extensions */
  hooks?: ViemHookRegistry;
}

export interface PaymentResult {
  success: boolean;
  txHash?: string;
  error?: string;
  timestamp: number;
}

export interface UnsignedPaymentPayload {
  from: `0x${string}`;
  to: `0x${string}`;
  amount: string;
  nonce: string;
  expiry: number;
  chainId: number;
  contractAddress: `0x${string}`;
  network: string;
}
