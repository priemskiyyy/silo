import { expect, test, vi } from "vitest";
import type { AsyncStorageAdapter } from "src/types/AsyncStorageAdapter";
import type { StorageChange } from "src/types/StorageChange";
import type { SyncStorageAdapter } from "src/types/SyncStorageAdapter";
import { createStorageAdapter } from "src/generators/createStorageAdapter";
import { testStorageAdapter } from "src/testing/testStorageAdapter";

const mapping = () => {
  const store = new Map<string, unknown>();
  const listeners = new Set<(change: StorageChange) => void>();
  const dispose = vi.fn();
  const stop = vi.fn();

  return {
    store,
    dispose,
    stop,
    emit: (change: StorageChange) => {
      for (const listener of listeners) {
        listener(change);
      }
    },
    sync: {
      mode: "sync",
      name: "memory",
      native: store,
      get: (key: string) => store.get(key),
      set: (key: string, value: unknown) => {
        store.set(key, value);
      },
      remove: (key: string) => {
        store.delete(key);
      },
      keys: () => [...store.keys()],
      available: () => true,
      dispose,
      observe: (listener: (change: StorageChange) => void) => {
        listeners.add(listener);

        return stop;
      },
    } satisfies SyncStorageAdapter<Map<string, unknown>>,
    async: {
      mode: "async",
      name: "indexeddb",
      native: store,
      get: (key: string) => Promise.resolve(store.get(key)),
      set: (key: string, value: unknown) => {
        store.set(key, value);

        return Promise.resolve();
      },
      remove: (key: string) => {
        store.delete(key);

        return Promise.resolve();
      },
      available: () => true,
      dispose,
    } satisfies AsyncStorageAdapter<Map<string, unknown>>,
  };
};

test("the mode, name and exact native type pass through", async () => {
  const provider = mapping();
  // Annotated, not inferred: a widened mode or native fails to compile here,
  // which is the whole reason the factory is not an identity function.
  const sync: SyncStorageAdapter<Map<string, unknown>> = createStorageAdapter(
    provider.sync,
  );
  const async: AsyncStorageAdapter<Map<string, unknown>> = createStorageAdapter(
    provider.async,
  );

  expect(sync.name).toBe("memory");
  expect(sync.native).toBe(provider.store);
  expect(async.native).toBe(provider.store);
  sync.set("key", "value");

  expect(sync.get("key")).toBe("value");
  expect(await async.get("key")).toBe("value");
});

test("an absent observe or keys stays absent rather than becoming undefined", () => {
  const provider = mapping();

  expect("observe" in createStorageAdapter(provider.async)).toBe(false);
  expect("keys" in createStorageAdapter(provider.async)).toBe(false);
  expect("observe" in createStorageAdapter(provider.sync)).toBe(true);
  expect("keys" in createStorageAdapter(provider.sync)).toBe(true);
});

test.each(["sync", "async"])(
  "optional methods keep their mapping receiver (%s)",
  async (mode) => {
    const provider = mapping();
    provider.store.set("theme", "dark");
    const methods = {
      native: provider.store,
      keys() {
        return [...this.native.keys()];
      },
      observe(listener: (change: StorageChange) => void) {
        listener({ key: "theme", value: this.native.get("theme") });
        return provider.stop;
      },
    };
    const asynchronous = {
      ...provider.async,
      ...methods,
      async keys() {
        return [...this.native.keys()];
      },
    };
    const adapter =
      mode === "async"
        ? createStorageAdapter(asynchronous)
        : createStorageAdapter({ ...provider.sync, ...methods });
    const listener = vi.fn();

    expect(await adapter.keys?.()).toEqual(["theme"]);
    const stop = adapter.observe?.(listener);
    expect(listener).toHaveBeenCalledExactlyOnceWith({
      key: "theme",
      value: "dark",
    });
    stop?.();
    expect(provider.stop).toHaveBeenCalledOnce();
    adapter.dispose();
  },
);

test("keys passes through and is refused after dispose", () => {
  const provider = mapping();
  const adapter = createStorageAdapter(provider.sync);

  adapter.set("theme", "dark");

  expect(adapter.keys?.()).toEqual(["theme"]);
  adapter.dispose();

  expect(() => adapter.keys?.()).toThrow(
    "Cannot list keys through the disposed memory storage adapter.",
  );
});

test("dispose runs the mapping's own dispose at most once", () => {
  const provider = mapping();
  const adapter = createStorageAdapter(provider.sync);

  adapter.dispose();
  adapter.dispose();
  adapter.dispose();

  expect(provider.dispose).toHaveBeenCalledTimes(1);
});

test("observers fall silent after dispose", () => {
  const provider = mapping();
  const adapter = createStorageAdapter(provider.sync);
  const listener = vi.fn();

  // Optional in the contract, so optional at the call site even here: the
  // wrapper preserves the member, not the knowledge that the mapping had it.
  adapter.observe?.(listener);
  provider.emit({ key: "key", value: "early" });
  adapter.dispose();
  provider.emit({ key: "key", value: "late" });
  provider.emit({ key: null });

  expect(listener).toHaveBeenCalledTimes(1);
  expect(listener).toHaveBeenCalledWith({ key: "key", value: "early" });
});

test.each(["sync", "async"])(
  "observing after disposal does not subscribe to the backend (%s)",
  (mode) => {
    const provider = mapping();
    const observe = vi.fn(provider.sync.observe);
    const adapter =
      mode === "async"
        ? createStorageAdapter({ ...provider.async, observe })
        : createStorageAdapter({ ...provider.sync, observe });
    const listener = vi.fn();

    adapter.dispose();
    const stop = adapter.observe?.(listener);
    provider.emit({ key: "theme", value: "late" });
    stop?.();
    stop?.();
    adapter.dispose();

    expect(observe).not.toHaveBeenCalled();
    expect(listener).not.toHaveBeenCalled();
    expect(provider.stop).not.toHaveBeenCalled();
    expect(provider.dispose).toHaveBeenCalledOnce();
  },
);

test("a disposed adapter refuses every operation with an error naming it", () => {
  const provider = mapping();
  const adapter = createStorageAdapter(provider.sync);

  adapter.dispose();

  expect(() => adapter.get("theme")).toThrow(
    'Cannot read "theme" through the disposed memory storage adapter.',
  );
  expect(() => adapter.set("theme", "dark")).toThrow(
    'Cannot write "theme" through the disposed memory storage adapter.',
  );
  expect(() => adapter.remove("theme")).toThrow(
    'Cannot remove "theme" through the disposed memory storage adapter.',
  );
  expect(provider.store.has("theme")).toBe(false);
});

test("an async mapping keeps its promises and its own name", async () => {
  const provider = mapping();
  const adapter = createStorageAdapter(provider.async);

  await adapter.set("theme", "dark");
  adapter.dispose();

  expect(() => adapter.get("theme")).toThrow(
    "disposed indexeddb storage adapter",
  );
  expect(provider.store.get("theme")).toBe("dark");
});

// The wrapper is an adapter too: the same suite every third-party adapter runs.
testStorageAdapter({
  name: "createStorageAdapter",
  createAdapter: () => createStorageAdapter(mapping().sync),
});

test("a keyspace declaration passes through, and an absent one stays absent", () => {
  const provider = mapping();
  const bare = createStorageAdapter({
    ...provider.sync,
    keyspace: { namespace: "hidden" },
  });

  expect(bare.keyspace).toEqual({ namespace: "hidden" });
  expect("keyspace" in createStorageAdapter(provider.sync)).toBe(false);
});
