/**
 * X402 Client Types - Coinbase Compatible
 */

import type {
  ExactEvmAuthorization,
  X402PaymentPayload,
  X402PaymentRequirements,
} from "@armory-sh/base";
import type { Account, Address, WalletClient } from "viem";

export type X402Wallet =
  | { type: "account"; account: Account }
  | { type: "walletClient"; walletClient: WalletClient };

export interface X402ClientConfig {
  wallet: X402Wallet;
  debug?: boolean;
  /** Override EIP-712 domain name for custom tokens */
  domainName?: string;
  /** Override EIP-712 domain version for custom tokens */
  domainVersion?: string;
}

export interface X402Client {
  fetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
  getAddress(): Address;
  createPayment(
    requirements: X402PaymentRequirements,
  ): Promise<X402PaymentPayload>;
  signPayment(
    authorization: ExactEvmAuthorization,
    network?: string,
  ): Promise<string>;
}

export interface X402PaymentResult {
  success: boolean;
  txHash?: string;
  error?: string;
  timestamp: number;
}
