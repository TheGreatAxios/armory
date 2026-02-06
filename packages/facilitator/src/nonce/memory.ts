import type {
  NonceTracker,
  NonceTrackerOptions,
  StoredNonce,
} from "./types.js";
import { NonceAlreadyUsedError } from "./types.js";

interface NonceEntry {
  timestamp: number;
  expiresAt?: number;
}

export class MemoryNonceTracker implements NonceTracker {
  private nonces: Map<string, NonceEntry>;
  private ttl?: number;

  constructor(options?: NonceTrackerOptions) {
    this.nonces = new Map();
    this.ttl = options?.ttl;
  }

  isUsed(nonce: string | number | bigint): boolean {
    const key = this.normalizeNonce(nonce);
    const entry = this.nonces.get(key);

    if (!entry) return false;

    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this.nonces.delete(key);
      return false;
    }

    return true;
  }

  markUsed(nonce: string | number | bigint): void {
    const key = this.normalizeNonce(nonce);

    if (this.isUsed(nonce)) throw new NonceAlreadyUsedError(nonce);

    const now = Date.now();
    this.nonces.set(key, {
      timestamp: now,
      expiresAt: this.ttl ? now + this.ttl : undefined,
    });
  }

  size(): number {
    // Lazy cleanup - only when size is checked
    const now = Date.now();
    for (const [key, entry] of this.nonces.entries()) {
      if (entry.expiresAt && now > entry.expiresAt) {
        this.nonces.delete(key);
      }
    }
    return this.nonces.size;
  }

  close(): void {
    this.clear();
  }

  clear(): void {
    this.nonces.clear();
  }

  private normalizeNonce(nonce: string | number | bigint): string {
    if (typeof nonce === "bigint") return nonce.toString();
    return String(nonce);
  }

  getAllNonces(): StoredNonce[] {
    const now = Date.now();
    const result: StoredNonce[] = [];

    for (const [key, entry] of this.nonces.entries()) {
      if (entry.expiresAt && now > entry.expiresAt) continue;

      result.push({
        nonce: key,
        timestamp: entry.timestamp,
        expiresAt: entry.expiresAt,
      });
    }

    return result;
  }
}

export const createNonceTracker = (
  options?: NonceTrackerOptions
): MemoryNonceTracker => new MemoryNonceTracker(options);
