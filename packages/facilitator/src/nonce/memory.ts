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
  private cleanupTimer?: ReturnType<typeof setInterval>;

  constructor(options?: NonceTrackerOptions) {
    this.nonces = new Map();
    this.ttl = options?.ttl;

    if (this.ttl) {
      const interval = options?.cleanupInterval ?? 60000;
      this.cleanupTimer = setInterval(() => this.cleanup(), interval);

      if (typeof this.cleanupTimer.unref === "function") {
        this.cleanupTimer.unref();
      }
    }
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

  cleanup(): void {
    const now = Date.now();

    for (const [key, entry] of this.nonces.entries()) {
      if (entry.expiresAt && now > entry.expiresAt) {
        this.nonces.delete(key);
      }
    }
  }

  size(): number {
    this.cleanup();
    return this.nonces.size;
  }

  close(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
    }
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
