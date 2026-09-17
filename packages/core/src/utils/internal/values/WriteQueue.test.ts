import { expect, test, vi } from "vitest";
import { WriteQueue } from "src/utils/internal/values/WriteQueue";
import type { Backend } from "src/utils/internal/adapter/Backend";
type WriteObserver = Parameters<Backend["set"]>[2];

type Sent = { kind: "set" | "remove"; raw: unknown; observer: WriteObserver };

// A backend that hands every write back to the test, so each one is settled
// or refused by hand and in any order.
const harness = (
  options: { state: "READY" | "PAUSED" } = { state: "READY" },
) => {
  const sent: Sent[] = [];
  const refusals: unknown[] = [];
  const backend: Pick<Backend, "set" | "remove"> = {
    set: (_key, raw, observer) => {
      sent.push({ kind: "set", raw, observer });
    },
    remove: (_key, observer) => {
      sent.push({ kind: "remove", raw: undefined, observer });
    },
  };
  const queue = new WriteQueue({
    key: "silo:theme",
    backend,
  });

  if (options.state === "READY") {
    queue.start();
  }
  const accept = (request: Parameters<WriteQueue["accept"]>[0]["request"]) =>
    queue.accept({
      request,
      observer: { error: (error) => refusals.push(error) },
    });
  return { queue, accept, sent, refusals };
};

const flushSettles = (queue: WriteQueue) => {
  const settled = vi.fn();
  const barrier = queue.flush();
  barrier.then(
    () => settled("resolved"),
    (error: unknown) => settled(error),
  );

  return { barrier, settled };
};

test("one write in flight, the latest pending, and the one in between never sent", () => {
  const { queue, accept, sent } = harness();

  accept({ kind: "set", raw: "a" });
  accept({ kind: "set", raw: "b" });
  accept({ kind: "remove" });

  expect(queue.busy()).toBe(true);
  expect(sent.map((write) => write.raw)).toEqual(["a"]);
  sent[0]?.observer.done();

  expect(sent.map((write) => write.kind)).toEqual(["set", "remove"]);
  sent[1]?.observer.done();

  expect(queue.busy()).toBe(false);
});

test("a barrier taken on a coalesced generation resolves when the write that superseded it lands", async () => {
  const { queue, accept, sent } = harness();

  accept({ kind: "set", raw: 1 });
  accept({ kind: "set", raw: 2 });
  const { settled } = flushSettles(queue);
  accept({ kind: "set", raw: 3 });
  sent[0]?.observer.done();
  await Promise.resolve();

  expect(settled).not.toHaveBeenCalled();
  sent[1]?.observer.done();
  await Promise.resolve();

  expect(sent.map((write) => write.raw)).toEqual([1, 3]);
  expect(settled).toHaveBeenCalledExactlyOnceWith("resolved");
  await expect(queue.flush()).resolves.toBeUndefined();
});

test("a refused write rejects its barriers, is reported once, and stands until a newer generation is accepted", async () => {
  const { queue, accept, sent, refusals } = harness();
  const failure = new Error("quota exceeded");

  accept({ kind: "set", raw: 1 });
  const { barrier } = flushSettles(queue);
  sent[0]?.observer.error(failure);

  await expect(barrier).rejects.toBe(failure);
  expect(refusals).toEqual([failure]);
  await expect(queue.flush()).rejects.toBe(failure);

  accept({ kind: "set", raw: 2 });

  sent[1]?.observer.done();
  await expect(queue.flush()).resolves.toBeUndefined();
  expect(refusals).toEqual([failure]);
});

test("a refusal of a generation that was already superseded is not reported", () => {
  const { accept, sent, refusals } = harness();

  accept({ kind: "set", raw: 1 });
  accept({ kind: "set", raw: 2 });
  sent[0]?.observer.error(new Error("too slow"));

  expect(refusals).toEqual([]);
  expect(sent.map((write) => write.raw)).toEqual([1, 2]);
});

test("a paused queue retains only the latest write until started", () => {
  const { queue, accept, sent } = harness({ state: "PAUSED" });
  accept({ kind: "set", raw: 1 });
  accept({ kind: "set", raw: 2 });
  expect(sent).toEqual([]);
  queue.start();
  queue.start();
  expect(sent.map((write) => write.raw)).toEqual([2]);
});

test("closing a paused queue refuses pending and future writes with the same error", async () => {
  const { queue, accept, sent, refusals } = harness({ state: "PAUSED" });
  const failure = new Error("migration 2 failed");
  accept({ kind: "set", raw: 1 });
  queue.close(failure);
  queue.start();
  accept({ kind: "set", raw: 2 });
  expect(sent).toEqual([]);
  expect(refusals).toEqual([failure, failure]);
  expect(queue.busy()).toBe(false);
  await expect(queue.flush()).rejects.toBe(failure);
});

test("an acknowledged outside mutation is already durable and clears a standing refusal", async () => {
  const { queue, accept, sent } = harness();

  accept({ kind: "set", raw: 1 });
  sent[0]?.observer.error(new Error("quota exceeded"));
  queue.acknowledge();

  await expect(queue.flush()).resolves.toBeUndefined();
});

test("closing rejects barriers and ignores late completion without sending pending writes", async () => {
  const { queue, accept, sent } = harness();
  accept({ kind: "set", raw: 1 });
  accept({ kind: "set", raw: 2 });
  const { barrier } = flushSettles(queue);
  const failure = new Error("disposed");
  queue.close(failure);
  await expect(barrier).rejects.toBe(failure);
  sent[0]?.observer.done();
  queue.start();
  expect(sent.map((write) => write.raw)).toEqual([1]);
  await expect(queue.flush()).rejects.toBe(failure);
});

test("unused and externally updated queues retain their diagnostic counters when writing begins", async () => {
  const { queue, accept, sent } = harness();
  expect(queue.inspect()).toEqual({ accepted: 0, durable: 0, inflight: false });
  expect(queue.busy()).toBe(false);
  await queue.flush();
  queue.acknowledge();
  queue.acknowledge();
  await queue.flush();
  expect(queue.inspect()).toEqual({ accepted: 2, durable: 2, inflight: false });

  accept({ kind: "set", raw: 1 });
  expect(queue.inspect()).toEqual({ accepted: 3, durable: 2, inflight: true });
  const flushed = queue.flush();
  sent[0]?.observer.done();
  await flushed;
  expect(queue.inspect()).toEqual({ accepted: 3, durable: 3, inflight: false });
  expect(queue.dirty).toBe(false);
});

test("new writes and barriers survive late callbacks from an earlier idle cycle", async () => {
  const { queue, accept, sent } = harness();
  accept({ kind: "set", raw: 1 });
  const first = queue.flush();
  const duplicate = queue.flush();
  sent[0]?.observer.done();
  await Promise.all([first, duplicate]);

  accept({ kind: "set", raw: 2 });
  const second = flushSettles(queue);
  sent[0]?.observer.done();
  sent[0]?.observer.error(new Error("late failure"));
  await Promise.resolve();
  expect(second.settled).not.toHaveBeenCalled();
  expect(queue.inspect()).toEqual({ accepted: 2, durable: 1, inflight: true });
  const failure = new Error("quota");
  sent[1]?.observer.error(failure);
  await expect(second.barrier).rejects.toBe(failure);

  accept({ kind: "remove" });
  const third = queue.flush();
  sent[2]?.observer.done();
  await third;
  expect(queue.inspect()).toEqual({ accepted: 3, durable: 3, inflight: false });
  expect(queue.busy()).toBe(false);
});

test("closing an unused queue preserves failure admission without inventing pending work", async () => {
  const { queue, accept, sent, refusals } = harness({ state: "PAUSED" });
  const failure = new Error("migration failed");
  queue.close(failure);
  queue.start();
  queue.acknowledge();
  await queue.flush();
  expect(queue.inspect()).toEqual({ accepted: 0, durable: 0, inflight: false });
  accept({ kind: "set", raw: 1 });
  await expect(queue.flush()).rejects.toBe(failure);
  expect(sent).toEqual([]);
  expect(refusals).toEqual([failure]);
  queue.dispose("disposed");
  await expect(queue.flush()).rejects.toThrow("disposed");
  expect(queue.inspect()).toEqual({ accepted: 1, durable: 0, inflight: false });
});
