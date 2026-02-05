export interface NonceTracker {
  isUsed(nonce: string | number | bigint): boolean;
  markUsed(nonce: string | number | bigint): void;
  cleanup?(): void;
  size?(): number;
}

export interface NonceTrackerOptions {
  ttl?: number;
  cleanupInterval?: number;
}

export interface StoredNonce {
  nonce: string;
  timestamp: number;
  expiresAt?: number;
}

export class NonceAlreadyUsedError extends Error {
  constructor(nonce: string | number | bigint) {
    super(`Nonce has already been used: ${nonce}`);
    this.name = "NonceAlreadyUsedError";
  }
}
