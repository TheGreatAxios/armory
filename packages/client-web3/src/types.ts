import type { Web3BaseWallet, Web3BaseWalletAccount } from "web3-types";
import type {
  PaymentPayloadV1,
  PaymentPayloadV2,
  PaymentRequirementsV1,
  PaymentRequirementsV2,
  SettlementResponseV1,
  SettlementResponseV2,
  NetworkConfig,
  CustomToken,
} from "@armory-sh/base";

export type Web3Account = Web3BaseWalletAccount | Web3BaseWallet<Web3BaseWalletAccount>;

/** Token configuration - can use pre-configured tokens from @armory-sh/tokens */
export type Token = CustomToken;

export interface Web3ClientConfig {
  account: Web3Account;
  network: NetworkConfig | string;
  version?: 1 | 2;
  rpcUrl?: string;
  /** Pre-configured token object (overrides individual fields below) */
  token?: Token;
  /** Override EIP-712 domain name for custom tokens */
  domainName?: string;
  /** Override EIP-712 domain version for custom tokens */
  domainVersion?: string;
}

export interface PaymentSignatureResult {
  v?: number;
  r?: string;
  s?: string;
  signature?: { v: number; r: string; s: string };
  payload: PaymentPayloadV1 | PaymentPayloadV2;
}

export interface PaymentSignOptions {
  amount: string | bigint;
  to: string;
  nonce?: string;
  expiry?: number;
  validAfter?: number;
}

export interface X402RequestContext {
  url: string;
  method: string;
  headers: Record<string, string> | Headers;
  body?: string | Record<string, unknown> | null;
  version: 1 | 2;
}

export interface X402TransportOptions {
  client: Web3X402Client;
  autoSign?: boolean;
  maxRetries?: number;
}

export interface Web3X402Client {
  getAccount(): Web3Account;
  getNetwork(): NetworkConfig;
  getVersion(): 1 | 2;
  signPayment(options: PaymentSignOptions): Promise<PaymentSignatureResult>;
  createPaymentHeaders(options: PaymentSignOptions): Promise<Headers>;
  handlePaymentRequired(
    requirements: PaymentRequirementsV1 | PaymentRequirementsV2
  ): Promise<PaymentSignatureResult>;
  verifySettlement(
    response: SettlementResponseV1 | SettlementResponseV2
  ): boolean;
}

export interface X402Transport {
  fetch(url: string | Request, init?: RequestInit): Promise<Response>;
  getClient(): Web3X402Client;
}

export interface Web3TransferWithAuthorization {
  from: string;
  to: string;
  value: string | bigint;
  validAfter: string | bigint;
  validBefore: string | bigint;
  nonce: string | bigint;
}

export interface Web3EIP712Domain {
  name: string;
  version: string;
  chainId: string | number;
  verifyingContract: string;
  [key: string]: string | number;
}

export const isV1Requirements = (
  requirements: PaymentRequirementsV1 | PaymentRequirementsV2
): requirements is PaymentRequirementsV1 => "contractAddress" in requirements;

export const isV2Requirements = (
  requirements: PaymentRequirementsV1 | PaymentRequirementsV2
): requirements is PaymentRequirementsV2 => "chainId" in requirements && "assetId" in requirements;

export const isV1Settlement = (
  response: SettlementResponseV1 | SettlementResponseV2
): response is SettlementResponseV1 => "success" in response;

export const isV2Settlement = (
  response: SettlementResponseV1 | SettlementResponseV2
): response is SettlementResponseV2 => "status" in response;
