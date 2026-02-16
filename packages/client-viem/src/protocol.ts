/**
 * X402 Protocol Implementation for Viem Client (V2 Only)
 *
 * Handles parsing x402 V2 PAYMENT-REQUIRED headers
 * and generating x402 V2 PAYMENT-SIGNATURE payloads
 */
import type {
  Account,
  Address,
  Hash,
  TypedDataDomain,
  WalletClient,
} from "viem";
import { PaymentError, SigningError } from "./errors";
import type {
  PaymentPayloadV2,
  PaymentRequirementsV2,
  EIP3009Authorization,
} from "@armory-sh/base";
import {
  V2_HEADERS,
  isX402V2PaymentRequired,
  encodePaymentV2,
  networkToCaip2,
  EIP712_TYPES,
  getNetworkByChainId,
} from "@armory-sh/base";
import { createEIP712Domain, createTransferWithAuthorization } from "@armory-sh/base";

export type X402Wallet =
  | { type: "account"; account: Account }
  | { type: "walletClient"; walletClient: WalletClient };

export type X402Version = 2;

export function detectX402Version(_response: Response): X402Version {
  return 2;
}

export function getWalletAddress(wallet: X402Wallet): Address {
  if (wallet.type === "account") {
    return wallet.account.address;
  }
  if (!wallet.walletClient.account) {
    throw new SigningError("WalletClient account is not connected");
  }
  return typeof wallet.walletClient.account === "string"
    ? (wallet.walletClient.account as Address)
    : wallet.walletClient.account.address;
}

export type ParsedPaymentRequirements = PaymentRequirementsV2;

function parseJsonOrBase64(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
  }

  const normalized = value
    .replace(/-/g, "+")
    .replace(/_/g, "/")
    .padEnd(Math.ceil(value.length / 4) * 4, "=");
  return JSON.parse(Buffer.from(normalized, "base64").toString("utf-8"));
}

export function parsePaymentRequired(response: Response): ParsedPaymentRequirements {
  const v2Header = response.headers.get(V2_HEADERS.PAYMENT_REQUIRED);

  if (!v2Header) {
    throw new PaymentError("No PAYMENT-REQUIRED header found in V2 response");
  }

  try {
    const parsed = parseJsonOrBase64(v2Header);

    if (!isX402V2PaymentRequired(parsed)) {
      throw new PaymentError("Invalid x402 V2 payment required format");
    }
    if (!parsed.accepts || parsed.accepts.length === 0) {
      throw new PaymentError("No payment requirements found in accepts array");
    }
    return parsed.accepts[0];
  } catch (error) {
    if (error instanceof PaymentError) throw error;
    throw new PaymentError(`Failed to parse V2 PAYMENT-REQUIRED header: ${error}`);
  }
}

export function getPaymentHeaderName(_version: X402Version): string {
  return V2_HEADERS.PAYMENT_SIGNATURE;
}

export function encodeX402Payment(payload: PaymentPayloadV2): string {
  return Buffer.from(JSON.stringify(payload)).toString("base64");
}

async function signTypedData(
  wallet: X402Wallet,
  domain: TypedDataDomain,
  authorization: EIP3009Authorization
): Promise<`0x${string}`> {
  const params = {
    domain,
    types: EIP712_TYPES,
    primaryType: "TransferWithAuthorization" as const,
    message: {
      from: authorization.from,
      to: authorization.to,
      value: BigInt(authorization.value),
      validAfter: BigInt(authorization.validAfter),
      validBefore: BigInt(authorization.validBefore),
      nonce: authorization.nonce,
    },
  };

  let signature: Hash;

  if (wallet.type === "account") {
    if (!wallet.account.signTypedData) {
      throw new SigningError("Account does not support signTypedData");
    }
    signature = await wallet.account.signTypedData(params);
  } else {
    const account = wallet.walletClient.account;
    if (!account) {
      throw new SigningError("WalletClient account is not connected");
    }
    signature = await wallet.walletClient.signTypedData({
      ...params,
      account,
    });
  }

  return signature;
}

function getChainIdFromNetwork(network: string): number {
  if (network.startsWith("eip155:")) {
    return parseInt(network.split(":")[1], 10);
  }
  const net = getNetworkByChainId(parseInt(network, 10));
  if (net) return net.chainId;
  throw new PaymentError(`Unsupported network: ${network}`);
}

export async function createX402Payment(
  wallet: X402Wallet,
  requirements: PaymentRequirementsV2,
  from: Address,
  nonce: `0x${string}` = `0x${Date.now().toString(16).padStart(64, "0")}` as `0x${string}`,
  validBefore?: number,
  domainName?: string,
  domainVersion?: string
): Promise<PaymentPayloadV2> {
  const chainId = getChainIdFromNetwork(requirements.network);
  const domain = createEIP712Domain(chainId, requirements.asset);

  if (domainName || domainVersion) {
    domain.name = domainName ?? domain.name;
    domain.version = domainVersion ?? domain.version;
  }

  const authorization: EIP3009Authorization = {
    from,
    to: requirements.payTo,
    value: requirements.amount,
    validAfter: "0",
    validBefore: (validBefore ?? Math.floor(Date.now() / 1000 + 3600)).toString(),
    nonce,
  };

  const signature = await signTypedData(wallet, domain, authorization);

  return {
    x402Version: 2,
    accepted: requirements,
    payload: {
      signature,
      authorization,
    },
  };
}
