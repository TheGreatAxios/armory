/**
 * X402 Payment Settlement - Coinbase Compatible
 * 
 * Settles X402 payment payloads on-chain using transferWithAuthorization.
 */

import type { Address, WalletClient } from "viem";
import {
  createPublicClient,
  http,
  BaseError,
  ContractFunctionExecutionError,
  ContractFunctionRevertedError,
} from "viem";
import type { X402PaymentPayload } from "@armory-sh/base";
import { ERC20_ABI, NETWORKS, parseSignatureV2 } from "@armory-sh/base";

export class X402SettlementError extends Error {
  override readonly cause?: unknown;

  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = "X402SettlementError";
    this.cause = cause;
  }
}

export class X402InvalidPaymentError extends X402SettlementError {
  constructor(message: string, cause?: unknown) {
    super(`Invalid payment payload: ${message}`, cause);
    this.name = "X402InvalidPaymentError";
  }
}

export class X402NetworkNotFoundError extends X402SettlementError {
  constructor(network: string) {
    super(`Network configuration not found: ${network}`);
    this.name = "X402NetworkNotFoundError";
  }
}

export class X402ContractExecutionError extends X402SettlementError {
  constructor(message: string, cause?: unknown) {
    super(`Contract execution failed: ${message}`, cause);
    this.name = "X402ContractExecutionError";
  }
}

export class X402AuthorizationExpiredError extends X402SettlementError {
  constructor(expiry: number) {
    const expiryDate = new Date(expiry * 1000);
    super(`Authorization expired at ${expiryDate.toISOString()}`);
    this.name = "X402AuthorizationExpiredError";
  }
}

export class X402InvalidSignatureError extends X402SettlementError {
  constructor(message: string = "Invalid signature provided") {
    super(message);
    this.name = "X402InvalidSignatureError";
  }
}

export class X402NonceAlreadyUsedError extends X402SettlementError {
  constructor(nonce: string) {
    super(`Nonce already used: ${nonce}`);
    this.name = "X402NonceAlreadyUsedError";
  }
}

export interface X402SettlementResult {
  txHash: string;
  blockNumber?: bigint;
}

export interface X402SettlePaymentParams {
  paymentPayload: X402PaymentPayload;
  walletClient: WalletClient;
  contractAddress?: Address;
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

function getChainIdFromNetwork(network: string): number {
  const chainId = NETWORK_TO_CHAIN_ID[network];
  if (!chainId) {
    const match = network.match(/^eip155:(\d+)$/);
    if (match) {
      return parseInt(match[1], 10);
    }
    throw new X402NetworkNotFoundError(network);
  }
  return chainId;
}

function validatePaymentPayload(payload: X402PaymentPayload): void {
  if (payload.x402Version !== 1) {
    throw new X402InvalidPaymentError(`Unsupported X402 version: ${payload.x402Version}`);
  }

  if (!payload.payload?.authorization) {
    throw new X402InvalidPaymentError("Missing authorization");
  }

  if (!payload.payload?.signature) {
    throw new X402InvalidPaymentError("Missing signature");
  }

  const auth = payload.payload.authorization;
  
  if (!auth.from || !/^0x[a-fA-F0-9]{40}$/.test(auth.from)) {
    throw new X402InvalidPaymentError("Invalid from address");
  }

  if (!auth.to || !/^0x[a-fA-F0-9]{40}$/.test(auth.to)) {
    throw new X402InvalidPaymentError("Invalid to address");
  }

  if (!auth.value || BigInt(auth.value) <= 0n) {
    throw new X402InvalidPaymentError("Invalid value");
  }

  if (!auth.nonce) {
    throw new X402InvalidPaymentError("Missing nonce");
  }

  if (!auth.validAfter || !auth.validBefore) {
    throw new X402InvalidPaymentError("Missing validity timestamps");
  }
}

function checkAuthorizationExpiry(validBefore: string): void {
  const now = Math.floor(Date.now() / 1000);
  const expiry = parseInt(validBefore, 10);

  if (expiry <= now) {
    throw new X402AuthorizationExpiredError(expiry);
  }
}

function extractRevertReason(
  error: ContractFunctionExecutionError | ContractFunctionRevertedError
): string | null {
  try {
    if ("reason" in error && typeof error.reason === "string") {
      return error.reason;
    }

    if ("data" in error && error.data) {
      if (typeof error.data === "string") return `Contract revert: ${error.data}`;
      if (typeof error.data === "object" && "errorName" in error.data) {
        return String(error.data.errorName);
      }
    }

    return null;
  } catch {
    return null;
  }
}

function createErrorFromMessage(
  message: string,
  error: BaseError
): X402SettlementError {
  if (message.includes("expired")) {
    return new X402AuthorizationExpiredError(0);
  }
  if (message.includes("invalid signature") || message.includes("signature")) {
    return new X402InvalidSignatureError(message);
  }
  if (message.includes("nonce") && (message.includes("used") || message.includes("replay"))) {
    return new X402NonceAlreadyUsedError("unknown");
  }

  if (
    error instanceof ContractFunctionExecutionError ||
    error instanceof ContractFunctionRevertedError
  ) {
    const reason = extractRevertReason(error);
    if (reason) return new X402ContractExecutionError(reason, error);
  }

  return new X402ContractExecutionError(message, error);
}

function handleContractError(error: unknown): X402SettlementError {
  if (error instanceof BaseError) {
    return createErrorFromMessage(error.message, error);
  }

  return new X402SettlementError(
    error instanceof Error ? error.message : "Unknown error",
    error
  );
}

export async function settleX402Payment(
  params: X402SettlePaymentParams
): Promise<X402SettlementResult> {
  const { paymentPayload, walletClient, contractAddress } = params;

  // Validate the payload
  validatePaymentPayload(paymentPayload);

  const auth = paymentPayload.payload.authorization;
  const signature = paymentPayload.payload.signature;

  // Check authorization hasn't expired
  checkAuthorizationExpiry(auth.validBefore);

  // Get chain ID from network
  const chainId = getChainIdFromNetwork(paymentPayload.network);

  // Find network configuration
  let networkConfig = null;
  for (const net of Object.values(NETWORKS)) {
    if (net.chainId === chainId) {
      networkConfig = net;
      break;
    }
  }

  if (!networkConfig && !contractAddress) {
    throw new X402NetworkNotFoundError(paymentPayload.network);
  }

  const tokenAddress = contractAddress ?? (networkConfig?.usdcAddress as Address);

  // Parse signature into v, r, s components
  const sig = parseSignatureV2(signature as `0x${string}`);

  try {
    const hash = await walletClient.writeContract({
      address: tokenAddress,
      abi: ERC20_ABI,
      functionName: "transferWithAuthorization",
      args: [
        auth.from as Address,
        auth.to as Address,
        BigInt(auth.value),
        BigInt(auth.validAfter),
        BigInt(auth.validBefore),
        sig.v,
        sig.r as `0x${string}`,
        sig.s as `0x${string}`,
      ],
      chain: walletClient.chain,
      account: walletClient.account ?? null,
    });

    return { txHash: hash };
  } catch (error) {
    throw handleContractError(error);
  }
}

// Re-export types for convenience
export type { X402PaymentPayload };
