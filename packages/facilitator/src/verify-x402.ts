/**
 * X402 Payment Verification - Coinbase Compatible
 * 
 * Verifies X402 payment payloads in the Coinbase format.
 */

import type { Address } from "viem";
import { recoverAddress, hashTypedData, createPublicClient, http } from "viem";
import type {
  X402PaymentPayload,
  X402PaymentRequirements,
  ExactEvmAuthorization,
} from "@armory-sh/base";
import {
  EIP712_TYPES,
  ERC20_ABI,
  NETWORKS,
  parseSignatureV2,
  fromAtomicUnits,
} from "@armory-sh/base";
import type { NonceTracker } from "./nonce/types.js";

export class X402VerificationError extends Error {
  override readonly cause?: unknown;

  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = "X402VerificationError";
    this.cause = cause;
  }
}

export class X402InvalidSignatureError extends X402VerificationError {
  constructor(message: string = "Invalid signature") {
    super(message);
    this.name = "X402InvalidSignatureError";
  }
}

export class X402InsufficientBalanceError extends X402VerificationError {
  constructor(
    public readonly requiredAmount: bigint,
    public readonly actualBalance: bigint
  ) {
    super(`Insufficient balance: required ${requiredAmount}, have ${actualBalance}`);
    this.name = "X402InsufficientBalanceError";
  }
}

export class X402NonceUsedError extends X402VerificationError {
  constructor(public readonly nonce: string) {
    super(`Nonce has already been used: ${nonce}`);
    this.name = "X402NonceUsedError";
  }
}

export class X402PaymentExpiredError extends X402VerificationError {
  constructor(
    public readonly expiry: number,
    public readonly currentTime: number
  ) {
    super(`Payment expired at ${expiry}, current time is ${currentTime}`);
    this.name = "X402PaymentExpiredError";
  }
}

export class X402PaymentNotYetValidError extends X402VerificationError {
  constructor(
    public readonly validAfter: number,
    public readonly currentTime: number
  ) {
    super(`Payment not valid until ${validAfter}, current time is ${currentTime}`);
    this.name = "X402PaymentNotYetValidError";
  }
}

export class X402UnsupportedNetworkError extends X402VerificationError {
  constructor(public readonly network: string) {
    super(`Unsupported network: ${network}`);
    this.name = "X402UnsupportedNetworkError";
  }
}

export class X402InvalidPayloadError extends X402VerificationError {
  constructor(message: string) {
    super(`Invalid payload: ${message}`);
    this.name = "X402InvalidPayloadError";
  }
}

export interface X402VerificationSuccess {
  success: true;
  payerAddress: Address;
  balance: bigint;
  requiredAmount: bigint;
}

export interface X402VerificationFailure {
  success: false;
  error: X402VerificationError;
}

export type X402VerificationResult = X402VerificationSuccess | X402VerificationFailure;

export interface X402VerifyOptions {
  nonceTracker?: NonceTracker;
  rpcUrl?: string;
  expiryGracePeriod?: number;
  skipBalanceCheck?: boolean;
  skipNonceCheck?: boolean;
  domainName?: string;
  domainVersion?: string;
}

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

function validateX402Payload(payload: X402PaymentPayload): void {
  if (payload.x402Version !== 1) {
    throw new X402InvalidPayloadError(`Unsupported X402 version: ${payload.x402Version}`);
  }

  if (payload.scheme !== "exact") {
    throw new X402InvalidPayloadError(`Unsupported scheme: ${payload.scheme}`);
  }

  if (!payload.payload) {
    throw new X402InvalidPayloadError("Missing payload");
  }

  if (!payload.payload.authorization) {
    throw new X402InvalidPayloadError("Missing authorization");
  }

  if (!payload.payload.signature) {
    throw new X402InvalidPayloadError("Missing signature");
  }

  const auth = payload.payload.authorization;
  validateAddress(auth.from, "from");
  validateAddress(auth.to, "to");

  if (!auth.value || BigInt(auth.value) <= 0n) {
    throw new X402InvalidPayloadError("Invalid value");
  }

  if (!auth.nonce) {
    throw new X402InvalidPayloadError("Missing nonce");
  }
}

function validateX402Requirements(requirements: X402PaymentRequirements): void {
  if (!requirements.maxAmountRequired) {
    throw new X402InvalidPayloadError("Missing maxAmountRequired");
  }

  if (!requirements.payTo) {
    throw new X402InvalidPayloadError("Missing payTo address");
  }

  if (!requirements.asset) {
    throw new X402InvalidPayloadError("Missing asset address");
  }

  validateAddress(requirements.payTo, "payTo");
  validateAddress(requirements.asset, "asset");
}

function validateAddress(address: string, fieldName: string): void {
  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
    throw new X402InvalidPayloadError(`Invalid '${fieldName}' address: ${address}`);
  }
}

function getChainIdFromNetwork(network: string): number {
  const chainId = NETWORK_TO_CHAIN_ID[network];
  if (!chainId) {
    // Try to parse from CAIP-2 format
    const match = network.match(/^eip155:(\d+)$/);
    if (match) {
      return parseInt(match[1], 10);
    }
    throw new X402UnsupportedNetworkError(network);
  }
  return chainId;
}

function getNetworkConfig(network: string) {
  const chainId = getChainIdFromNetwork(network);
  
  for (const net of Object.values(NETWORKS)) {
    if (net.chainId === chainId) {
      return net;
    }
  }
  
  return undefined;
}

async function verifyX402Signature(
  payload: X402PaymentPayload,
  contractAddress: Address,
  options: X402VerifyOptions
): Promise<Address> {
  const auth = payload.payload.authorization;
  const network = getNetworkConfig(payload.network);
  
  if (!network) {
    throw new X402UnsupportedNetworkError(payload.network);
  }

  const chainId = getChainIdFromNetwork(payload.network);
  
  const domainName = options.domainName ?? 
    (payload.network.startsWith("base") ? "USD Coin" : "USDC");
  const domainVersion = options.domainVersion ?? "2";

  const hash = hashTypedData({
    domain: {
      name: domainName,
      version: domainVersion,
      chainId,
      verifyingContract: contractAddress,
    },
    types: EIP712_TYPES,
    primaryType: "TransferWithAuthorization",
    message: {
      from: auth.from as Address,
      to: auth.to as Address,
      value: BigInt(auth.value),
      validAfter: BigInt(auth.validAfter),
      validBefore: BigInt(auth.validBefore),
      nonce: BigInt(auth.nonce),
    },
  });

  const sig = parseSignatureV2(payload.payload.signature as `0x${string}`);

  return await recoverAddress({
    hash,
    signature: {
      r: sig.r as `0x${string}`,
      s: sig.s as `0x${string}`,
      yParity: sig.v === 27 ? 0 : 1,
    },
  });
}

function checkX402ValidityWindow(
  auth: ExactEvmAuthorization,
  gracePeriodSeconds: number
): void {
  const now = Math.floor(Date.now() / 1000);
  const validAfter = parseInt(auth.validAfter, 10);
  const validBefore = parseInt(auth.validBefore, 10);

  if (validAfter > now) {
    throw new X402PaymentNotYetValidError(validAfter, now);
  }

  if (validBefore < now - gracePeriodSeconds) {
    throw new X402PaymentExpiredError(validBefore, now);
  }
}

function checkX402Nonce(
  nonce: string,
  nonceTracker?: NonceTracker
): void {
  if (!nonceTracker) return;

  if (nonceTracker.isUsed(nonce)) {
    throw new X402NonceUsedError(nonce);
  }

  nonceTracker.markUsed(nonce);
}

async function checkX402Balance(
  payerAddress: Address,
  contractAddress: Address,
  rpcUrl: string
): Promise<bigint> {
  const client = createPublicClient({
    transport: http(rpcUrl),
  });

  const balance = await client.readContract({
    address: contractAddress,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: [payerAddress],
  });

  return balance as bigint;
}

export async function verifyX402Payment(
  payload: X402PaymentPayload,
  requirements: X402PaymentRequirements,
  options: X402VerifyOptions = {}
): Promise<X402VerificationResult> {
  try {
    validateX402Payload(payload);
    validateX402Requirements(requirements);

    const auth = payload.payload.authorization;
    
    const payerAddress = await verifyX402Signature(
      payload,
      requirements.asset as Address,
      options
    );

    if (payerAddress.toLowerCase() !== auth.from.toLowerCase()) {
      throw new X402InvalidSignatureError(
        `Signer address ${payerAddress} does not match from address ${auth.from}`
      );
    }

    checkX402ValidityWindow(auth, options.expiryGracePeriod ?? 0);

    if (!options.skipNonceCheck) {
      checkX402Nonce(auth.nonce, options.nonceTracker);
    }

    const requiredAmount = BigInt(requirements.maxAmountRequired);
    
    if (options.skipBalanceCheck) {
      return {
        success: true,
        payerAddress,
        balance: 0n,
        requiredAmount,
      };
    }

    const rpcUrl = options.rpcUrl ?? getNetworkConfig(payload.network)?.rpcUrl;
    if (!rpcUrl) {
      throw new X402InvalidPayloadError("Missing RPC URL for balance check");
    }

    const balance = await checkX402Balance(
      payerAddress,
      requirements.asset as Address,
      rpcUrl
    );

    if (balance < requiredAmount) {
      throw new X402InsufficientBalanceError(requiredAmount, balance);
    }

    return {
      success: true,
      payerAddress,
      balance,
      requiredAmount,
    };
  } catch (error) {
    if (error instanceof X402VerificationError) {
      return { success: false, error };
    }
    return {
      success: false,
      error: new X402VerificationError(
        error instanceof Error ? error.message : "Unknown verification error",
        error
      ),
    };
  }
}

// Re-export types for convenience
export type {
  X402PaymentPayload,
  X402PaymentRequirements,
};
