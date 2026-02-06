import type {
  Address,
  Account,
  WalletClient,
  Transport,
} from "viem";
import type { PaymentPayloadV1, PaymentPayloadV2, CustomToken } from "@armory-sh/base";

export type X402Wallet =
  | { type: "account"; account: Account }
  | { type: "walletClient"; walletClient: WalletClient };

export type X402ProtocolVersion = 1 | 2 | "auto";

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
}

export interface X402Client {
  fetch: typeof fetch;
  getAddress(): Address;
  createPayment(
    amount: string,
    to: Address,
    contractAddress: Address,
    chainId: number,
    expiry?: number
  ): Promise<PaymentPayloadV1 | PaymentPayloadV2>;
  signPayment<T extends PaymentPayloadV1 | PaymentPayloadV2>(
    payload: Omit<T, "signature" | "v" | "r" | "s">
  ): Promise<T>;
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
}

export interface PaymentResult {
  success: boolean;
  txHash?: string;
  error?: string;
  timestamp: number;
}
