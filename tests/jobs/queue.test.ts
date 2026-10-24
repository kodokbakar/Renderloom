import { describe, expect, test } from "bun:test";
import { BoundedQueue } from "../../src/jobs/queue";

describe("BoundedQueue", () => {
  test("enforces concurrency limit deterministically", async () => {
    const queue = new BoundedQueue(2);
    let activeNow = 0;
    let maxSeenActive = 0;
    const completed: number[] = [];

    const gate0 = Promise.withResolvers<void>();
    const gate1 = Promise.withResolvers<void>();
    const gate2 = Promise.withResolvers<void>();
    const gate3 = Promise.withResolvers<void>();
    const gateList = [gate0, gate1, gate2, gate3];

    const makeTask = (index: number) => async () => {
      activeNow++;
      maxSeenActive = Math.max(maxSeenActive, activeNow);
      await gateList[index]?.promise;
      activeNow--;
      completed.push(index + 1);
      return index + 1;
    };

    const p1 = queue.enqueue(makeTask(0));
    const p2 = queue.enqueue(makeTask(1));
    const p3 = queue.enqueue(makeTask(2));
    const p4 = queue.enqueue(makeTask(3));

    expect(queue.runningCount).toBe(2);
    expect(queue.pendingCount).toBe(2);
    expect(queue.size).toBe(4);
    expect(maxSeenActive).toBe(2);

    // Release first task
    gate0.resolve();
    await p1;

    // Now task 3 should start
    expect(queue.runningCount).toBe(2);
    expect(queue.pendingCount).toBe(1);

    // Release remaining tasks
    gate1.resolve();
    gate2.resolve();
    gate3.resolve();

    const results = await Promise.all([p1, p2, p3, p4]);
    expect(results).toEqual([1, 2, 3, 4]);
    expect(maxSeenActive).toBe(2);
    expect(queue.runningCount).toBe(0);
    expect(queue.pendingCount).toBe(0);
  });

  test("cancels a queued task before execution", async () => {
    const queue = new BoundedQueue(1);
    const completed: number[] = [];
    const gate = Promise.withResolvers<void>();

    const t1 = queue.enqueue(async () => {
      await gate.promise;
      completed.push(1);
      return 1;
    }, "task-1");

    const t2 = queue.enqueue(async () => {
      completed.push(2);
      return 2;
    }, "task-2");

    expect(queue.pendingCount).toBe(1);
    const didCancel = queue.cancel("task-2");
    expect(didCancel).toBe(true);
    expect(queue.pendingCount).toBe(0);

    const didCancelAgain = queue.cancel("task-2");
    expect(didCancelAgain).toBe(false);

    await expect(t2).rejects.toThrow(
      "Task 'task-2' was cancelled before execution",
    );
    gate.resolve();
    const r1 = await t1;
    expect(r1).toBe(1);
    expect(completed).toEqual([1]);
  });

  test("clear() cancels all pending tasks", async () => {
    const queue = new BoundedQueue(1);
    const gate = Promise.withResolvers<void>();

    const t1 = queue.enqueue(async () => {
      await gate.promise;
      return 1;
    });

    const t2 = queue.enqueue(async () => 2, "task-2");
    const t3 = queue.enqueue(async () => 3, "task-3");

    queue.clear();
    expect(queue.pendingCount).toBe(0);

    await expect(t2).rejects.toThrow("cancelled before execution");
    await expect(t3).rejects.toThrow("cancelled before execution");
    gate.resolve();
    expect(await t1).toBe(1);
  });

  test("onIdle waits for all active and queued tasks", async () => {
    const queue = new BoundedQueue(2);
    let done = 0;
    const gate1 = Promise.withResolvers<void>();
    const gate2 = Promise.withResolvers<void>();

    queue.enqueue(async () => {
      await gate1.promise;
      done++;
    });
    queue.enqueue(async () => {
      await gate2.promise;
      done++;
    });

    const idlePromise = queue.onIdle();
    expect(done).toBe(0);

    gate1.resolve();
    gate2.resolve();

    await idlePromise;
    expect(done).toBe(2);
    expect(queue.size).toBe(0);
  });

  test("rejects invalid concurrency", () => {
    expect(() => new BoundedQueue(0)).toThrow();
    expect(() => new BoundedQueue(-1)).toThrow();
    expect(() => new BoundedQueue(1.5)).toThrow();
  });
});
