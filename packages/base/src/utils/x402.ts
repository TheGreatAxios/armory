/**
 * X402 Protocol Utilities - Coinbase Compatible
 *
 * Helper functions for nonce generation, amount conversion, and other utilities.
 */

import { randomBytes } from "node:crypto";
import type { Address, Hex } from "../types/x402";

/**
 * Generate a random 32-byte nonce as hex string
 * Matches Coinbase SDK format: "0x" + 64 hex characters
 */
export function createNonce(): Hex {
  const bytes = randomBytes(32);
  return `0x${bytes.toString("hex")}` as Hex;
}

/**
 * Convert human-readable amount to atomic units
 * e.g., "1.5" USDC -> "1500000" (6 decimals)
 */
export function toAtomicUnits(amount: string, decimals: number = 6): string {
  const parts = amount.split(".");
  const whole = parts[0];
  const fractional = parts[1] || "";
  const paddedFractional = fractional.padEnd(decimals, "0").slice(0, decimals);
  return `${whole}${paddedFractional}`;
}

/**
 * Convert atomic units to human-readable amount
 * e.g., "1500000" -> "1.5" USDC (6 decimals)
 */
export function fromAtomicUnits(amount: string, decimals: number = 6): string {
  const value = BigInt(amount);
  const divisor = BigInt(10 ** decimals);
  const whole = (value / divisor).toString();
  const fractional = (value % divisor)
    .toString()
    .padStart(decimals, "0")
    .replace(/0+$/, "");

  if (fractional.length === 0) {
    return whole;
  }
  return `${whole}.${fractional}`;
}

/**
 * Parse signature from hex string to components
 * Returns { r, s, v } where v is 27 or 28
 */
export function parseSignature(signature: Hex): { r: Hex; s: Hex; v: number } {
  const hex = signature.startsWith("0x") ? signature.slice(2) : signature;
  const r = `0x${hex.slice(0, 64)}` as Hex;
  const s = `0x${hex.slice(64, 128)}` as Hex;
  const v = parseInt(hex.slice(128, 130) || "1c", 16);
  return { r, s, v };
}

/**
 * Combine signature components into hex string
 */
export function combineSignature(r: Hex, s: Hex, v: number): Hex {
  const rHex = r.startsWith("0x") ? r.slice(2) : r;
  const sHex = s.startsWith("0x") ? s.slice(2) : s;
  const vHex = v.toString(16).padStart(2, "0");
  return `0x${rHex}${sHex}${vHex}` as Hex;
}

/**
 * Convert CAIP-2 chain ID to network name
 * e.g., "eip155:8453" -> "base"
 */
export function caip2ToNetwork(caip2Id: string): string {
  const match = caip2Id.match(/^eip155:(\d+)$/);
  if (!match) {
    return caip2Id;
  }

  const chainId = parseInt(match[1], 10);
  const chainIdToNetwork: Record<number, string> = {
    1: "ethereum",
    8453: "base",
    84532: "base-sepolia",
    137: "polygon",
    42161: "arbitrum",
    421614: "arbitrum-sepolia",
    10: "optimism",
    11155420: "optimism-sepolia",
    11155111: "ethereum-sepolia",
  };

  return chainIdToNetwork[chainId] || caip2Id;
}

/**
 * Convert network name to CAIP-2 chain ID
 * e.g., "base" -> "eip155:8453"
 */
export function networkToCaip2(network: string): string {
  const networkToChainId: Record<string, number> = {
    ethereum: 1,
    base: 8453,
    "base-sepolia": 84532,
    polygon: 137,
    arbitrum: 42161,
    "arbitrum-sepolia": 421614,
    optimism: 10,
    "optimism-sepolia": 11155420,
    "ethereum-sepolia": 11155111,
  };

  const chainId = networkToChainId[network];
  if (chainId) {
    return `eip155:${chainId}`;
  }

  // If already in CAIP-2 format, return as-is
  if (network.startsWith("eip155:")) {
    return network;
  }

  return `eip155:0`;
}

/**
 * Get current Unix timestamp in seconds
 */
export function getCurrentTimestamp(): number {
  return Math.floor(Date.now() / 1000);
}

/**
 * Validate Ethereum address
 */
export function isValidAddress(address: string): address is Address {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

/**
 * Normalize address to checksum format (basic lowercase)
 */
export function normalizeAddress(address: string): Address {
  return address.toLowerCase() as Address;
}
