import { expect, test } from "vitest";
import type { AsyncStorageAdapter } from "src/types/AsyncStorageAdapter";
import type { StorageAdapter } from "src/types/StorageAdapter";
import type { StorageChange } from "src/types/StorageChange";
import type { SyncStorageAdapter } from "src/types/SyncStorageAdapter";
import type { MockNative } from "src/mock/createMockAdapter";
import { createMockAdapter } from "src/mock/createMockAdapter";

const collect = (adapter: StorageAdapter<MockNative>) => {
  const changes: StorageChange[] = [];

  if (typeof adapter.observe !== "function") {
    throw new Error("The mock dropped observe.");
  }

  return { changes, stop: adapter.observe((change) => changes.push(change)) };
};

test("each mode is typed as its own contract", async () => {
  // Annotated: the mock stands in wherever a real adapter does, and a union
  // would be assignable to neither contract.
  const sync: SyncStorageAdapter<MockNative> = createMockAdapter().adapter;
  const async: AsyncStorageAdapter<MockNative> = createMockAdapter({
    mode: "async",
  }).adapter;

  sync.set("key", "value");

  expect(sync.get("key")).toBe("value");
  expect(await async.set("key", "value")).toBeUndefined();
  expect(await async.get("key")).toBe("value");
  expect(async.native.store.get("key")).toBe("value");
});

test("every call is recorded in order, with the value set received", () => {
  const mock = createMockAdapter();

  mock.adapter.set("silo:theme", "dark");
  mock.adapter.get("silo:theme");
  mock.adapter.remove("silo:theme");

  expect(
    mock.calls.map((call) => [call.operation, call.key, call.value]),
  ).toEqual([
    ["set", "silo:theme", "dark"],
    ["get", "silo:theme", undefined],
    ["remove", "silo:theme", undefined],
  ]);
  expect(mock.calls.every((call) => !call.pending)).toBe(true);
});

test("held operations settle in whatever order the test chooses", async () => {
  const mock = createMockAdapter({ mode: "async", hold: true });
  const settled: string[] = [];
  const first = mock.adapter.set("a", 1).then(() => settled.push("a"));
  const second = mock.adapter.set("b", 2).then(() => settled.push("b"));
  const [callA, callB] = mock.calls;

  expect(mock.store.size).toBe(0);
  callB?.settle();
  await second;

  expect(settled).toEqual(["b"]);
  callA?.settle();
  await first;

  expect(settled).toEqual(["b", "a"]);
  // Settlement order, not call order, is what reaches the store.
  expect([...mock.store]).toEqual([
    ["b", 2],
    ["a", 1],
  ]);
});

test("a held read answers with what the store holds when it settles", async () => {
  const mock = createMockAdapter({ mode: "async", hold: true });
  const read = mock.adapter.get("a");

  mock.store.set("a", "late arrival");
  mock.calls[0]?.settle();

  expect(await read).toBe("late arrival");
});

test("a failed operation rejects and leaves the store untouched", async () => {
  const mock = createMockAdapter({ mode: "async", hold: true });
  const write = mock.adapter.set("a", 1);

  mock.calls[0]?.fail(new Error("quota exceeded"));

  await expect(write).rejects.toThrow("quota exceeded");
  expect(mock.store.has("a")).toBe(false);
  expect(() => mock.calls[0]?.settle()).toThrow(
    'The mock set of "a" already settled and cannot be settled again.',
  );
});

test("a settled call cannot be settled again", () => {
  const mock = createMockAdapter();

  mock.adapter.get("a");

  expect(() => mock.calls[0]?.settle()).toThrow("already settled");
});

test("the hook fails one operation and the call stays on the record", () => {
  const mock = createMockAdapter({
    onCall: (call) => {
      if (call.operation !== "set") {
        return;
      }

      if (call.key !== "boom") {
        return;
      }

      throw new Error("quota exceeded");
    },
  });

  mock.adapter.set("fine", 1);

  expect(() => mock.adapter.set("boom", 2)).toThrow("quota exceeded");
  expect(mock.store.has("boom")).toBe(false);
  expect(mock.calls).toHaveLength(2);
});

test("an async failure arrives as a rejection, never as a throw", async () => {
  const mock = createMockAdapter({
    mode: "async",
    onCall: () => {
      throw new Error("quota exceeded");
    },
  });
  const read = mock.adapter.get("a");

  expect(read).toBeInstanceOf(Promise);
  await expect(read).rejects.toThrow("quota exceeded");
});

test("emit reports self-echoes, duplicates and stale values without writing", () => {
  const mock = createMockAdapter();
  const observer = collect(mock.adapter);

  mock.adapter.set("a", "fresh");
  mock.emit({ key: "a", value: "fresh" });
  mock.emit({ key: "a", value: "fresh" });
  mock.emit({ key: "a", value: "stale" });
  mock.emit({ key: null });

  expect(observer.changes).toEqual([
    { key: "a", value: "fresh" },
    { key: "a", value: "fresh" },
    { key: "a", value: "stale" },
    { key: null },
  ]);
  expect(mock.store.get("a")).toBe("fresh");
  observer.stop();
  mock.emit({ key: "a", value: "later" });

  expect(observer.changes).toHaveLength(4);
});

test("emission after dispose is refused by default and available on demand", () => {
  const silent = createMockAdapter();
  const silenced = collect(silent.adapter);
  const loud = createMockAdapter({ emitAfterDispose: true });
  const heard = collect(loud.adapter);

  silent.adapter.dispose();
  loud.adapter.dispose();
  silent.emit({ key: "a", value: "late" });
  loud.emit({ key: "a", value: "late" });

  expect(silenced.changes).toEqual([]);
  expect(heard.changes).toEqual([{ key: "a", value: "late" }]);
});

test("observe and keys can each be dropped, for the core's capability guards", () => {
  const mock = createMockAdapter({ observe: false, keys: false });

  expect("observe" in mock.adapter).toBe(false);
  expect("keys" in mock.adapter).toBe(false);
});

test("keys answers from the store in both modes, unrecorded, and is refused after dispose", async () => {
  const sync = createMockAdapter();
  const async = createMockAdapter({ mode: "async", hold: true });

  sync.adapter.set("a", 1);
  async.store.set("b", 2);

  expect(sync.adapter.keys?.()).toEqual(["a"]);
  // Not held, even on a holding mock: enumeration is not a mutation a test needs to order.
  expect(await async.adapter.keys?.()).toEqual(["b"]);
  expect(sync.calls.map((call) => call.operation)).toEqual(["set"]);
  expect(async.calls).toEqual([]);

  sync.adapter.dispose();
  async.adapter.dispose();

  expect(() => sync.adapter.keys?.()).toThrow(
    "Cannot list keys through the disposed mock storage adapter.",
  );
  await expect(async.adapter.keys?.()).rejects.toThrow(
    "Cannot list keys through the disposed mock storage adapter.",
  );
});

test("dispose is counted and later operations are refused in both modes", async () => {
  const sync = createMockAdapter();
  const async = createMockAdapter({ mode: "async" });

  sync.adapter.dispose();
  sync.adapter.dispose();
  async.adapter.dispose();

  expect(sync.disposeCount()).toBe(2);
  expect(async.disposeCount()).toBe(1);
  expect(() => sync.adapter.get("a")).toThrow(
    'Cannot get "a" through the disposed mock storage adapter.',
  );
  await expect(async.adapter.set("a", 1)).rejects.toThrow(
    'Cannot set "a" through the disposed mock storage adapter.',
  );
  expect(sync.calls).toEqual([]);
});

test("native is the identity stable control surface", () => {
  const mock = createMockAdapter();

  expect(mock.adapter.native).toBe(mock.adapter.native);
  expect(mock.adapter.native.store).toBe(mock.store);
  expect(mock.adapter.native.calls).toBe(mock.calls);
  expect(mock.adapter.native.emit).toBe(mock.emit);
});
