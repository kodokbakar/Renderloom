export interface QueueItem<T = unknown> {
  id: string;
  fn: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (reason?: unknown) => void;
}

export class BoundedQueue {
  readonly concurrency: number;
  private pending: QueueItem<unknown>[] = [];
  private activeCount = 0;
  private idleResolvers: Array<() => void> = [];

  constructor(concurrency = 2) {
    if (concurrency < 1 || !Number.isInteger(concurrency)) {
      throw new Error("Concurrency must be an integer of at least 1");
    }
    this.concurrency = concurrency;
  }

  get pendingCount(): number {
    return this.pending.length;
  }

  get runningCount(): number {
    return this.activeCount;
  }

  get size(): number {
    return this.pending.length + this.activeCount;
  }

  enqueue<T>(fn: () => Promise<T>, id?: string): Promise<T> {
    const taskId = id ?? crypto.randomUUID();
    const { promise, resolve, reject } = Promise.withResolvers<T>();

    this.pending.push({
      id: taskId,
      fn: fn as () => Promise<unknown>,
      resolve: resolve as (value: unknown) => void,
      reject,
    });

    this.processNext();
    return promise;
  }

  cancel(id: string): boolean {
    const idx = this.pending.findIndex((item) => item.id === id);
    if (idx !== -1) {
      const item = this.pending.splice(idx, 1)[0];
      if (item) {
        const err = new Error(`Task '${id}' was cancelled before execution`);
        err.name = "AbortError";
        item.reject(err);
        return true;
      }
    }
    return false;
  }

  clear(): void {
    const items = this.pending.splice(0, this.pending.length);
    for (const item of items) {
      const err = new Error(`Task '${item.id}' was cancelled before execution`);
      err.name = "AbortError";
      item.reject(err);
    }
  }

  async onIdle(): Promise<void> {
    if (this.activeCount === 0 && this.pending.length === 0) {
      return;
    }
    const { promise, resolve } = Promise.withResolvers<void>();
    this.idleResolvers.push(resolve);
    return promise;
  }

  private processNext(): void {
    if (this.activeCount >= this.concurrency || this.pending.length === 0) {
      if (this.activeCount === 0 && this.pending.length === 0) {
        const resolvers = this.idleResolvers.splice(
          0,
          this.idleResolvers.length,
        );
        for (const r of resolvers) r();
      }
      return;
    }

    const item = this.pending.shift();
    if (!item) return;

    this.activeCount++;
    (async () => {
      try {
        const result = await item.fn();
        item.resolve(result);
      } catch (err) {
        item.reject(err);
      } finally {
        this.activeCount--;
        this.processNext();
      }
    })();
  }
}
