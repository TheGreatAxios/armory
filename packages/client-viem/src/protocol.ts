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
} from "@armory-sh/base";
import { createEIP712Domain, createTransferWithAuthorization } from "@armory-sh/base";

export type X402Wallet =
  | { type: "account"; account: Account }
  | { type: "walletClient"; walletClient: { account: Account } };

export type X402Version = 2;

export function detectX402Version(_response: Response): X402Version {
  return 2;
}

export function getWalletAddress(wallet: X402Wallet): Address {
  return wallet.type === "account"
    ? wallet.account.address
    : wallet.walletClient.account.address;
}

export type ParsedPaymentRequirements = PaymentRequirementsV2;

export function parsePaymentRequired(response: Response): ParsedPaymentRequirements {
  const v2Header = response.headers.get(V2_HEADERS.PAYMENT_REQUIRED);

  if (!v2Header) {
    throw new PaymentError("No PAYMENT-REQUIRED header found in V2 response");
  }

  try {
    const decoded = Buffer.from(v2Header, "base64").toString("utf-8");
    const parsed = JSON.parse(decoded) as PaymentRequirementsV2;

    if (!isX402V2PaymentRequired(parsed)) {
      throw new PaymentError("Invalid x402 V2 payment required format");
    }

    return parsed;
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

export async function createX402Payment(
  wallet: X402Wallet,
  requirements: PaymentRequirementsV2,
  from: Address,
  nonce: `0x${string}` = `0x${Date.now().toString(16).padStart(64, "0")}` as `0x${string}`,
  validBefore?: number,
  _domainName?: string,
  _domainVersion?: string
): Promise<PaymentPayloadV2> {
  const walletAccount = wallet.type === "account" ? wallet.account : wallet.walletClient.account;

  if (!walletAccount.signTypedData) {
    throw new SigningError("Wallet account does not support signTypedData");
  }

  const authorization: EIP3009Authorization = {
    from,
    to: requirements.payTo,
    value: requirements.amount,
    validAfter: "0",
    validBefore: (validBefore ?? Math.floor(Date.now() / 1000 + 3600)).toString(),
    nonce,
  };

  return {
    x402Version: 2,
    scheme: requirements.scheme,
    network: requirements.network,
    payload: {
      signature: "0x",
      authorization,
    },
  };
}
