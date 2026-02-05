import type {
  PaymentQueue,
  SettleJob,
  SettleJobId,
  QueueOptions,
  SettleResult,
} from "./types";

const DEFAULT_MAX_RETRIES = 3;

interface QueueState {
  pending: SettleJob[];
  processing: Map<SettleJobId, SettleJob>;
  completed: Map<SettleJobId, SettleJob>;
  failed: Map<SettleJobId, SettleJob>;
}

const generateJobId = (): SettleJobId =>
  `job_${Date.now()}_${crypto.randomUUID()}`;

export class MemoryQueue implements PaymentQueue {
  private state: QueueState;
  private maxRetries: number;
  private closed: boolean = false;

  constructor(options: QueueOptions = {}) {
    this.maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;
    this.state = {
      pending: [],
      processing: new Map(),
      completed: new Map(),
      failed: new Map(),
    };
  }

  enqueue(job: Omit<SettleJob, "id" | "createdAt" | "retries">): void {
    if (this.closed) throw new Error("Queue is closed");

    this.state.pending.push({
      ...job,
      id: generateJobId(),
      createdAt: Date.now(),
      retries: 0,
    });
  }

  dequeue(): SettleJob | undefined {
    if (this.closed) throw new Error("Queue is closed");

    const job = this.state.pending.shift();
    if (job) this.state.processing.set(job.id, job);
    return job;
  }

  complete(id: SettleJobId, result: SettleResult): void {
    if (this.closed) throw new Error("Queue is closed");

    const processing = this.state.processing.get(id);
    if (!processing) throw new Error(`Job ${id} not found in processing queue`);

    if (result.success) {
      this.state.processing.delete(id);
      this.state.completed.set(id, processing);
    } else {
      this.fail(id, result.errorReason);
    }
  }

  fail(id: SettleJobId, _errorReason: string): void {
    if (this.closed) throw new Error("Queue is closed");

    const processing = this.state.processing.get(id);
    if (!processing) throw new Error(`Job ${id} not found in processing queue`);

    this.state.processing.delete(id);

    const updatedJob: SettleJob = {
      ...processing,
      retries: processing.retries + 1,
    };

    if (updatedJob.retries < this.maxRetries) {
      this.state.pending.push(updatedJob);
    } else {
      this.state.failed.set(id, updatedJob);
    }
  }

  size(): number {
    return this.state.pending.length;
  }

  getProcessingCount(): number {
    return this.state.processing.size;
  }

  getCompletedCount(): number {
    return this.state.completed.size;
  }

  getFailedCount(): number {
    return this.state.failed.size;
  }

  getJob(id: SettleJobId): SettleJob | undefined {
    return (
      this.state.pending.find((j) => j.id === id) ??
      this.state.processing.get(id) ??
      this.state.completed.get(id) ??
      this.state.failed.get(id)
    );
  }

  close(): void {
    this.closed = true;
    this.state.pending = [];
    this.state.processing.clear();
    this.state.completed.clear();
    this.state.failed.clear();
  }

  isClosed(): boolean {
    return this.closed;
  }

  static create(options?: QueueOptions): MemoryQueue {
    return new MemoryQueue(options);
  }
}

export const createMemoryQueue = (options?: QueueOptions): PaymentQueue =>
  MemoryQueue.create(options);
