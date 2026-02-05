import type { PaymentPayload, PaymentRequirements } from "@armory/core";

export type SettleJobId = string;
export type RetryCount = number;

export interface SettleJob {
  id: SettleJobId;
  paymentPayload: PaymentPayload;
  paymentRequirements: PaymentRequirements;
  createdAt: number;
  retries: RetryCount;
}

export type SettleResult =
  | { success: true; transaction: string }
  | { success: false; errorReason: string };

export interface PaymentQueue {
  enqueue(job: SettleJob): void;
  dequeue(): SettleJob | undefined;
  complete(id: SettleJobId, result: SettleResult): void;
  fail(id: SettleJobId, errorReason: string): void;
  size(): number;
  close(): void;
}

export interface QueueOptions {
  maxRetries?: number;
  retryDelay?: number;
}
