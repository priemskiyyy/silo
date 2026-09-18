import { expect, test, vi } from "vitest";
import type { AsyncTextStorageMapping } from "src/types/AsyncTextStorageMapping";
import type { SyncTextStorageMapping } from "src/types/SyncTextStorageMapping";
import type { TextStorageChange } from "src/types/TextStorageChange";
import { createTextStorageAdapter } from "src/generators/createTextStorageAdapter";
import { testStorageAdapter } from "src/testing/testStorageAdapter";

// A text backend the way a platform exposes one: strings in a Map, absent as
// `null`, and `emit` to play another writer. Both live on `native`, so a
// harness holding only the adapter can reach them.
type TextControls = {
  store: Map<string, string>;
  emit: (change: TextStorageChange) => void;
};

const textBackend = () => {
  const store = new Map<string, string>();
  const listeners = new Set<(change: TextStorageChange) => void>();
  const dispose = vi.fn();
  const native: TextControls = {
    store,
    emit: (change) => {
      for (const listener of [...listeners]) {
        listener(change);
      }
    },
  };

  const shared = {
    name: "text",
    native,
    available: () => true,
    dispose,
    observe: (listener: (change: TextStorageChange) => void) => {
      listeners.add(listener);

      return () => {
        listeners.delete(listener);
      };
    },
  };

  return {
    store,
    dispose,
    emit: native.emit,
    sync: {
      ...shared,
      mode: "sync",
      read: (key: string) => store.get(key) ?? null,
      write: (key: string, text: string) => {
        store.set(key, text);
      },
      remove: (key: string) => {
        store.delete(key);
      },
      keys: () => [...store.keys()],
    } satisfies SyncTextStorageMapping<TextControls>,
    async: {
      ...shared,
      mode: "async",
      read: async (key: string) => store.get(key),
      write: async (key: string, text: string) => {
        store.set(key, text);
      },
      remove: async (key: string) => {
        store.delete(key);
      },
      keys: async () => [...store.keys()],
    } satisfies AsyncTextStorageMapping<TextControls>,
  };
};

// Another writer changes the text and the platform announces it.
const externalWrite = (
  { store, emit }: TextControls,
  change: { key: string; value: unknown } | { key: null },
) => {
  if (change.key === null) {
    store.clear();
    emit({ key: null });
    return;
  }

  const text = JSON.stringify(change.value);
  store.set(change.key, text);
  emit({ key: change.key, text });
};

test("a value is stored as JSON text and read back decoded, in both modes", async () => {
  const backend = textBackend();
  const sync = createTextStorageAdapter(backend.sync);
  const async = createTextStorageAdapter(backend.async);

  sync.set("silo:theme", { dark: true });
  await async.set("silo:visits", 3);

  expect(backend.store.get("silo:theme")).toBe('{"dark":true}');
  expect(backend.store.get("silo:visits")).toBe("3");
  expect(sync.get("silo:theme")).toEqual({ dark: true });
  expect(await async.get("silo:visits")).toBe(3);
  expect(sync.mode).toBe("sync");
  expect(async.mode).toBe("async");
  expect(sync.name).toBe("text");
  expect(sync.native.store).toBe(backend.store);
});

test("absent reads undefined whether the platform says null or undefined, and a stored null stays distinct", async () => {
  const backend = textBackend();
  const sync = createTextStorageAdapter(backend.sync);
  const async = createTextStorageAdapter(backend.async);

  expect(sync.get("silo:missing")).toBeUndefined();
  expect(await async.get("silo:missing")).toBeUndefined();

  sync.set("silo:nothing", null);

  expect(sync.get("silo:nothing")).toBeNull();
});

test("undefined is a removal, never the string undefined", () => {
  const backend = textBackend();
  const adapter = createTextStorageAdapter(backend.sync);

  adapter.set("silo:theme", "dark");
  adapter.set("silo:theme", undefined);

  expect(backend.store.has("silo:theme")).toBe(false);
});

test("a stored text this adapter did not write throws on read and rejects when asynchronous", async () => {
  const backend = textBackend();
  backend.store.set("silo:theme", "not json");

  expect(() =>
    createTextStorageAdapter(backend.sync).get("silo:theme"),
  ).toThrow(SyntaxError);
  await expect(
    createTextStorageAdapter(backend.async).get("silo:theme"),
  ).rejects.toThrow(SyntaxError);
});

test("an observed text change is decoded, an absent one reports undefined, and one that will not decode is dropped", () => {
  const backend = textBackend();
  const adapter = createTextStorageAdapter(backend.sync);
  const listener = vi.fn();

  adapter.observe?.(listener);
  backend.emit({ key: "silo:theme", text: '"dark"' });
  backend.emit({ key: "silo:theme", text: null });
  backend.emit({ key: "silo:theme", text: "not json" });
  backend.emit({ key: null });

  expect(listener.mock.calls).toEqual([
    [{ key: "silo:theme", value: "dark" }],
    [{ key: "silo:theme", value: undefined }],
    [{ key: null }],
  ]);
});

test("a format replaces JSON on both sides, and its undefined is a removal too", () => {
  const backend = textBackend();
  const format = {
    stringify: (value: unknown) =>
      value === undefined ? undefined : `wrapped:${JSON.stringify(value)}`,
    parse: (text: string) => JSON.parse(text.replace(/^wrapped:/u, "")),
  };
  const adapter = createTextStorageAdapter({ ...backend.sync, format });

  adapter.set("silo:theme", "dark");

  expect(backend.store.get("silo:theme")).toBe('wrapped:"dark"');
  expect(adapter.get("silo:theme")).toBe("dark");

  adapter.set("silo:theme", undefined);

  expect(backend.store.has("silo:theme")).toBe(false);
});

test("keys and observe stay absent when the mapping has none", () => {
  const backend = textBackend();
  const { keys, observe, ...bare } = backend.sync;
  const adapter = createTextStorageAdapter(bare);

  expect(typeof keys).toBe("function");
  expect(typeof observe).toBe("function");
  expect("keys" in adapter).toBe(false);
  expect("observe" in adapter).toBe(false);
});

test.each(["sync", "async"])(
  "optional methods keep their text mapping receiver (%s)",
  async (mode) => {
    const backend = textBackend();
    backend.store.set("theme", '"dark"');
    const unsubscribe = vi.fn();
    const methods = {
      native: backend.sync.native,
      keys() {
        return [...this.native.store.keys()];
      },
      observe(listener: (change: TextStorageChange) => void) {
        listener({ key: "theme", text: this.native.store.get("theme") });
        return unsubscribe;
      },
    };
    const asynchronous = {
      ...backend.async,
      ...methods,
      async keys() {
        return [...this.native.store.keys()];
      },
    };
    const adapter =
      mode === "async"
        ? createTextStorageAdapter(asynchronous)
        : createTextStorageAdapter({ ...backend.sync, ...methods });
    const listener = vi.fn();

    expect(await adapter.keys?.()).toEqual(["theme"]);
    const stop = adapter.observe?.(listener);
    expect(listener).toHaveBeenCalledExactlyOnceWith({
      key: "theme",
      value: "dark",
    });
    stop?.();
    expect(unsubscribe).toHaveBeenCalledOnce();
    adapter.dispose();
  },
);

test("dispose reaches the mapping once", () => {
  const backend = textBackend();
  const adapter = createTextStorageAdapter(backend.sync);

  adapter.dispose();
  adapter.dispose();

  expect(backend.dispose).toHaveBeenCalledTimes(1);
});

// The adapter built here is an adapter like any other, in both modes.
testStorageAdapter({
  name: "createTextStorageAdapter sync",
  createAdapter: () => createTextStorageAdapter(textBackend().sync),
  externalWrite: (adapter, change) => externalWrite(adapter.native, change),
});

testStorageAdapter({
  name: "createTextStorageAdapter async",
  createAdapter: () => createTextStorageAdapter(textBackend().async),
  externalWrite: (adapter, change) => externalWrite(adapter.native, change),
});
