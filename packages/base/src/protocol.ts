/**
 * X402 Protocol Utilities (V2 Only)
 *
 * Shared protocol utilities for x402 client implementations.
 * These functions are protocol-level and don't depend on wallet libraries.
 */

import { V2_HEADERS } from "./types/v2";
import { decodeBase64ToUtf8, normalizeBase64Url } from "./utils/base64";

/**
 * Parse JSON or Base64-encoded JSON
 * Handles both raw JSON and Base64URL-encoded JSON
 */
export function parseJsonOrBase64(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    const normalized = normalizeBase64Url(value);
    return JSON.parse(decodeBase64ToUtf8(normalized));
  }
}

/**
 * Detect x402 protocol version from response
 * V2-only: Always returns 2
 */
export function detectX402Version(_response: Response): 2 {
  return 2;
}

/**
 * Get payment header name for protocol version
 * V2-only: Returns PAYMENT-SIGNATURE header name
 */
export function getPaymentHeaderName(_version: 2): string {
  return V2_HEADERS.PAYMENT_SIGNATURE;
}

/**
 * Generate a timestamp-based nonce as hex string
 * Matches Coinbase SDK format: "0x" + 64 hex characters
 * Uses timestamp for reproducibility (vs random)
 */
export function generateNonce(): `0x${string}` {
  const now = Math.floor(Date.now() / 1000);
  return `0x${(now * 1000).toString(16).padStart(64, "0")}` as `0x${string}`;
}

/**
 * Calculate expiry timestamp
 * @param expirySeconds - Seconds from now (default: 3600 = 1 hour)
 * @returns Unix timestamp
 */
export function calculateValidBefore(expirySeconds: number = 3600): number {
  return Math.floor(Date.now() / 1000) + expirySeconds;
}
