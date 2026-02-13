/**
 * X402 Client for Viem - Coinbase Compatible
 * 
 * This client generates payment payloads that are fully compatible with 
 * the Coinbase x402 SDK and facilitator.
 */

import type {
  Account,
  Address,
  Hash,
  TypedDataDomain,
  WalletClient,
  Chain,
  Transport,
} from "viem";
import { hashTypedData, recoverMessageAddress } from "viem";
// Import X402 types and utilities from base package
import type {
  X402PaymentPayload,
  X402PaymentRequirements,
  ExactEvmAuthorization,
  X402SettlementResponse,
} from "@armory-sh/base";

import {
  X402_VERSION,
  createEIP712Domain,
  EIP712_TYPES,
  encodePayment,
  X402_HEADERS,
  safeBase64Encode,
  safeBase64Decode,
  createNonce,
  toAtomicUnits,
  combineSignature,
} from "@armory-sh/base";

import type { X402Client, X402ClientConfig, X402Wallet } from "./types-x402";
import { SigningError, PaymentError } from "./errors";

const DEFAULT_EXPIRY = 3600;

// Network name to chain ID mapping
const NETWORK_TO_CHAIN_ID: Record<string, number> = {
  "base": 8453,
  "base-sepolia": 84532,
  "ethereum": 1,
  "ethereum-sepolia": 11155111,
  "polygon": 137,
  "polygon-amoy": 80002,
  "arbitrum": 42161,
  "arbitrum-sepolia": 421614,
  "optimism": 10,
  "optimism-sepolia": 11155420,
};

function getChainIdFromNetwork(network: string): number {
  const chainId = NETWORK_TO_CHAIN_ID[network];
  if (chainId) return chainId;
  
  // Try to parse from CAIP-2 format
  const match = network.match(/^eip155:(\d+)$/);
  if (match) return parseInt(match[1], 10);
  
  throw new Error(`Unknown network: ${network}`);
}

function parseSignatureToHex(signature: Hash): string {
  // Remove 0x prefix if present
  const sig = signature.startsWith("0x") ? signature.slice(2) : signature;
  // Return full hex with prefix
  return `0x${sig}`;
}

function getWalletAddress(wallet: X402Wallet): Address {
  if (wallet.type === "account") {
    return wallet.account.address;
  }
  const account = wallet.walletClient.account;
  if (!account) {
    throw new SigningError("Wallet client has no account");
  }
  return account.address;
}

async function signTypedData(
  wallet: X402Wallet,
  domain: TypedDataDomain,
  message: ExactEvmAuthorization
): Promise<string> {
  const params = {
    domain,
    types: EIP712_TYPES,
    primaryType: "TransferWithAuthorization" as const,
    message: {
      from: message.from,
      to: message.to,
      value: BigInt(message.value),
      validAfter: BigInt(message.validAfter),
      validBefore: BigInt(message.validBefore),
      nonce: message.nonce,
    },
  };

  let signature: Hash;
  
  if (wallet.type === "account") {
    if (!wallet.account.signTypedData) {
      throw new SigningError("Account does not support signTypedData");
    }
    signature = await wallet.account.signTypedData(params);
  } else {
    signature = await wallet.walletClient.signTypedData({
      ...params,
      account: wallet.walletClient.account,
    });
  }

  return parseSignatureToHex(signature);
}

function getNetworkFromRequirements(requirements: X402PaymentRequirements): string {
  return requirements.network;
}

function getAssetFromRequirements(requirements: X402PaymentRequirements): Address {
  return requirements.asset;
}

async function createPaymentPayload(
  wallet: X402Wallet,
  requirements: X402PaymentRequirements,
  domainName?: string,
  domainVersion?: string
): Promise<X402PaymentPayload> {
  const from = getWalletAddress(wallet);
  const network = getNetworkFromRequirements(requirements);
  const asset = getAssetFromRequirements(requirements);
  
  const now = Math.floor(Date.now() / 1000);
  const validAfter = now - 600; // 10 minutes ago (like Coinbase)
  const validBefore = now + requirements.maxTimeoutSeconds;
  const nonce = createNonce();
  
  const authorization: ExactEvmAuthorization = {
    from,
    to: requirements.payTo,
    value: requirements.maxAmountRequired,
    validAfter: validAfter.toString(),
    validBefore: validBefore.toString(),
    nonce,
  };

  const chainId = getChainIdFromNetwork(network);
  const domain = createEIP712Domain(
    chainId,
    asset
  );

  // Override domain name/version if provided
  if (domainName || domainVersion) {
    domain.name = domainName ?? domain.name;
    domain.version = domainVersion ?? domain.version;
  }

  const signature = await signTypedData(wallet, domain, authorization);

  return {
    x402Version: X402_VERSION,
    scheme: "exact",
    network,
    payload: {
      signature,
      authorization,
    },
  };
}

function extractRequirementsFromResponse(response: Response): X402PaymentRequirements {
  const encoded = response.headers.get(X402_HEADERS.PAYMENT_REQUIRED);
  if (!encoded) {
    throw new PaymentError("No payment requirements found in 402 response");
  }

  try {
    const decoded = safeBase64Decode(encoded);
    const parsed = JSON.parse(decoded);
    
    if (parsed.accepts && Array.isArray(parsed.accepts) && parsed.accepts.length > 0) {
      return parsed.accepts[0] as X402PaymentRequirements;
    }
    
    throw new PaymentError("Invalid payment requirements format");
  } catch (error) {
    throw new PaymentError(`Failed to parse payment requirements: ${error}`);
  }
}

function addPaymentHeader(headers: Headers, payment: X402PaymentPayload): void {
  headers.set(X402_HEADERS.PAYMENT, encodePayment(payment));
}

function checkSettlement(response: Response): void {
  const encoded = response.headers.get(X402_HEADERS.PAYMENT_RESPONSE);
  if (!encoded) return;

  try {
    const decoded = safeBase64Decode(encoded);
    const settlement = JSON.parse(decoded) as X402SettlementResponse;
    
    if (!settlement.success) {
      throw new PaymentError(settlement.errorReason || "Payment settlement failed");
    }
  } catch {
    // Ignore invalid settlement headers
  }
}

export function createX402Client(config: X402ClientConfig): X402Client {
  const { wallet, debug = false } = config;
  
  async function fetchWithPayment(
    input: RequestInfo | URL,
    init?: RequestInit
  ): Promise<Response> {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    
    if (debug) {
      console.log(`[X402] Fetching: ${url}`);
    }

    let response = await fetch(input, init);

    if (response.status === 402) {
      if (debug) {
        console.log(`[X402] Payment required for: ${url}`);
      }

      const requirements = extractRequirementsFromResponse(response);
      
      if (debug) {
        console.log(`[X402] Payment requirements:`, requirements);
      }

      const payment = await createPaymentPayload(
        wallet,
        requirements,
        config.domainName,
        config.domainVersion
      );

      if (debug) {
        console.log(`[X402] Created payment:`, payment);
      }

      const headers = new Headers(init?.headers);
      addPaymentHeader(headers, payment);

      response = await fetch(input, { ...init, headers });

      if (debug) {
        console.log(`[X402] Payment response status: ${response.status}`);
      }

      checkSettlement(response);
    }

    return response;
  }

  return {
    fetch: fetchWithPayment,
    
    getAddress: () => getWalletAddress(wallet),
    
    async createPayment(requirements: X402PaymentRequirements): Promise<X402PaymentPayload> {
      return createPaymentPayload(wallet, requirements, config.domainName, config.domainVersion);
    },
    
    async signPayment(authorization: ExactEvmAuthorization, network?: string): Promise<string> {
      const networkName = network || "base";
      const chainId = getChainIdFromNetwork(networkName);
      const domain = createEIP712Domain(chainId, authorization.from);
      if (config.domainName || config.domainVersion) {
        domain.name = config.domainName ?? domain.name;
        domain.version = config.domainVersion ?? domain.version;
      }
      return signTypedData(wallet, domain, authorization);
    },
  };
}

export function createX402Transport(config: X402ClientConfig): typeof fetch {
  const client = createX402Client(config);
  return client.fetch;
}
