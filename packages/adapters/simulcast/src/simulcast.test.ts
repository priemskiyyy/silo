import { Silo, value } from "@priemskiyyy/silo";
import type { StorageChange } from "@priemskiyyy/silo";
import { createMockAdapter } from "@priemskiyyy/silo/mock";
import { expect, test, vi } from "vitest";
import { createRealtime } from "src/realtime.fixture";
import { simulcast } from "src/simulcast";

const KEY = "silo:theme";

test("a synchronous adapter is forwarded member by member, renamed, and stays synchronous", () => {
  const realtime = createRealtime();
  const inner = createMockAdapter();
  const adapter = simulcast({
    adapter: inner.adapter,
    channel: realtime.channel,
  });

  expect(adapter.mode).toBe("sync");
  expect(adapter.name).toBe("mock+simulcast");
  expect(adapter.native).toBe(inner.adapter.native);
  expect(adapter.available()).toBe(true);

  expect(adapter.set(KEY, "dark")).toBeUndefined();
  expect(inner.store.get(KEY)).toBe("dark");
  expect(adapter.get(KEY)).toBe("dark");
  expect(adapter.keys?.()).toEqual([KEY]);
  expect(adapter.remove(KEY)).toBeUndefined();
  expect(inner.store.has(KEY)).toBe(false);
  adapter.dispose();
});

test("an asynchronous adapter is forwarded and stays asynchronous", async () => {
  const realtime = createRealtime();
  const inner = createMockAdapter({ mode: "async" });
  const adapter = simulcast({
    adapter: inner.adapter,
    channel: realtime.channel,
  });

  expect(adapter.mode).toBe("async");
  const written = adapter.set(KEY, "dark");

  expect(written).toBeInstanceOf(Promise);
  await written;
  expect(inner.store.get(KEY)).toBe("dark");
  expect(await adapter.get(KEY)).toBe("dark");
  expect(await adapter.keys?.()).toEqual([KEY]);
  await adapter.remove(KEY);
  expect(inner.store.has(KEY)).toBe(false);
  adapter.dispose();
});

test("the wrapped adapter's keyspace declaration travels with it", () => {
  const realtime = createRealtime();
  const bare = simulcast({
    adapter: createMockAdapter().adapter,
    channel: realtime.channel,
  });
  const hidden = simulcast({
    adapter: {
      ...createMockAdapter().adapter,
      keyspace: { namespace: "hidden" },
    },
    channel: realtime.channel,
  });

  expect(bare.keyspace).toBeUndefined();
  expect(hidden.keyspace).toEqual({ namespace: "hidden" });
  bare.dispose();
  hidden.dispose();
});

test("keys is absent when the wrapped adapter has none", () => {
  const realtime = createRealtime();
  const adapter = simulcast({
    adapter: createMockAdapter({ keys: false }).adapter,
    channel: realtime.channel,
  });

  expect(adapter.keys).toBeUndefined();
  adapter.dispose();
});

test("publish announces a landed write and a removal, and never a write that failed", () => {
  const realtime = createRealtime();
  const inner = createMockAdapter({
    onCall: (call) => {
      if (call.value === "refused") {
        throw new Error("disk full");
      }
    },
  });
  const publish = vi.fn();
  const adapter = simulcast({
    adapter: inner.adapter,
    channel: realtime.channel,
    publish,
  });

  adapter.set(KEY, "dark");
  adapter.remove(KEY);
  expect(() => adapter.set(KEY, "refused")).toThrow("disk full");

  expect(publish.mock.calls).toEqual([
    [{ key: KEY, value: "dark" }],
    [{ key: KEY, value: undefined }],
  ]);
  adapter.dispose();
});

test("publish on an asynchronous adapter runs once the write has settled", async () => {
  const realtime = createRealtime();
  const inner = createMockAdapter({ mode: "async", hold: true });
  const publish = vi.fn();
  const adapter = simulcast({
    adapter: inner.adapter,
    channel: realtime.channel,
    publish,
  });

  const written = adapter.set(KEY, "dark");
  const failed = adapter.set(KEY, "refused");

  expect(publish).not.toHaveBeenCalled();
  inner.calls[0]?.settle();
  inner.calls[1]?.fail(new Error("disk full"));
  await written;
  await expect(failed).rejects.toThrow("disk full");

  expect(publish.mock.calls).toEqual([[{ key: KEY, value: "dark" }]]);
  adapter.dispose();
});

test("a publish that throws or rejects does not fail the write", async () => {
  const realtime = createRealtime();
  const unhandled: unknown[] = [];
  const handleUnhandled = (reason: unknown) => {
    unhandled.push(reason);
  };
  process.on("unhandledRejection", handleUnhandled);
  const throwing = simulcast({
    adapter: createMockAdapter().adapter,
    channel: realtime.channel,
    publish: () => {
      throw new Error("channel down");
    },
  });
  const rejecting = simulcast({
    adapter: createMockAdapter({ mode: "async" }).adapter,
    channel: realtime.channel,
    publish: () => Promise.reject(new Error("channel down")),
  });

  expect(() => throwing.set(KEY, "dark")).not.toThrow();
  expect(throwing.get(KEY)).toBe("dark");
  await expect(rejecting.set(KEY, "dark")).resolves.toBeUndefined();
  expect(await rejecting.get(KEY)).toBe("dark");
  await new Promise((resolve) => setTimeout(resolve, 0));
  process.off("unhandledRejection", handleUnhandled);

  expect(unhandled).toEqual([]);
  throwing.dispose();
  rejecting.dispose();
});

test("an observer receives the changes published on the channel and ignores everything else", () => {
  const realtime = createRealtime();
  const adapter = simulcast({
    adapter: createMockAdapter().adapter,
    channel: realtime.channel,
  });
  const changes: StorageChange[] = [];
  const stop = adapter.observe?.((change) => changes.push(change));

  realtime.emit({ key: KEY, value: "dark" });
  realtime.emit({ key: KEY });
  realtime.emit({ key: null });
  realtime.emit("hello");
  realtime.emit({ nope: 1 });
  realtime.emit({ key: 5, value: "dark" });
  realtime.emit(null);

  expect(changes).toEqual([
    { key: KEY, value: "dark" },
    { key: KEY, value: undefined },
    { key: null },
  ]);
  stop?.();
  adapter.dispose();
});

test("the wrapped adapter's own reports reach the same observer, and stop releases both", () => {
  const realtime = createRealtime();
  const inner = createMockAdapter();
  const adapter = simulcast({
    adapter: inner.adapter,
    channel: realtime.channel,
  });
  const changes: StorageChange[] = [];
  const stop = adapter.observe?.((change) => changes.push(change));

  inner.emit({ key: KEY, value: "from the tab" });
  realtime.emit({ key: KEY, value: "from the server" });
  expect(realtime.subscriptions()).toHaveLength(1);

  stop?.();
  inner.emit({ key: KEY, value: "late" });
  realtime.emit({ key: KEY, value: "late" });

  expect(changes).toEqual([
    { key: KEY, value: "from the tab" },
    { key: KEY, value: "from the server" },
  ]);
  // The channel lost its last consumer, so the native subscription is gone.
  expect(realtime.subscriptions()).toHaveLength(0);
  adapter.dispose();
});

test("dispose silences every observer still registered, then disposes the wrapped adapter", () => {
  const realtime = createRealtime();
  const inner = createMockAdapter();
  const adapter = simulcast({
    adapter: inner.adapter,
    channel: realtime.channel,
  });
  const changes: StorageChange[] = [];

  adapter.observe?.((change) => changes.push(change));
  adapter.observe?.((change) => changes.push(change));
  adapter.dispose();
  realtime.emit({ key: KEY, value: "late" });

  expect(changes).toEqual([]);
  expect(realtime.subscriptions()).toHaveLength(0);
  expect(inner.disposeCount()).toBe(1);
  expect(() => adapter.get(KEY)).toThrow("disposed mock storage adapter");
});

test("a silo over the bridge updates in place from a publication its own adapter never saw", () => {
  const realtime = createRealtime();
  const inner = createMockAdapter();
  const silo = new Silo({
    storages: {
      default: {
        adapters: [
          simulcast({ adapter: inner.adapter, channel: realtime.channel }),
        ],
        schema: { theme: value<"light" | "dark">({ fallback: "light" }) },
      },
    },
  });
  const theme = silo.value("theme");
  const listener = vi.fn();
  theme.subscribe(listener);

  expect(theme.get()).toBe("light");

  realtime.announce({ key: KEY, value: "dark" });

  expect(theme.get()).toBe("dark");
  expect(listener).toHaveBeenCalledTimes(1);
  expect(inner.store.has(KEY)).toBe(false);

  realtime.announce({ key: KEY, value: undefined });

  expect(theme.get()).toBe("light");
  silo.dispose();
});

test("an available override decides the probe instead of the wrapped adapter", () => {
  const realtime = createRealtime();
  const inner = createMockAdapter();
  const gated = simulcast({
    adapter: inner.adapter,
    channel: realtime.channel,
    available: () => false,
  });

  expect(inner.adapter.available()).toBe(true);
  expect(gated.available()).toBe(false);
  gated.dispose();
});

test("dispose is idempotent and observing afterwards does not subscribe", () => {
  const realtime = createRealtime();
  const inner = createMockAdapter();
  const dispose = vi.spyOn(inner.adapter, "dispose");
  const adapter = simulcast({
    adapter: inner.adapter,
    channel: realtime.channel,
  });

  adapter.dispose();
  adapter.dispose();
  const stop = adapter.observe?.(() => undefined);

  expect(dispose).toHaveBeenCalledOnce();
  expect(realtime.subscriptions()).toHaveLength(0);
  stop?.();
});

test("a write settling after disposal does not publish", async () => {
  const realtime = createRealtime();
  const inner = createMockAdapter({ mode: "async", hold: true });
  const publish = vi.fn();
  const adapter = simulcast({
    adapter: inner.adapter,
    channel: realtime.channel,
    publish,
  });
  const written = adapter.set(KEY, "dark");

  adapter.dispose();
  inner.calls[0]?.settle();
  await written;

  expect(publish).not.toHaveBeenCalled();
});

test("a failed inner subscription releases the channel subscription", () => {
  const realtime = createRealtime();
  const inner = createMockAdapter();
  const adapter = simulcast({
    adapter: {
      ...inner.adapter,
      observe: () => {
        throw new Error("observer unavailable");
      },
    },
    channel: realtime.channel,
  });

  expect(() => adapter.observe?.(() => undefined)).toThrow(
    "observer unavailable",
  );
  expect(realtime.subscriptions()).toHaveLength(0);
  adapter.dispose();
});
