import { expect, test, vi } from "vitest";
import { createTextStorageAdapter } from "src/generators/createTextStorageAdapter";
import { createMockAdapter } from "src/mock/createMockAdapter";
import type { StorageAdapter } from "src/types/StorageAdapter";
import type { StorageChange } from "src/types/StorageChange";
import type { TextStorageChange } from "src/types/TextStorageChange";
import { Silo } from "src/utils/Silo";
import { value } from "src/utils/value";

const Schema = { count: value({ fallback: 0 }) };
const createSilo = (adapter: StorageAdapter) =>
  new Silo({ storages: { default: { adapters: [adapter], schema: Schema } } });

test.each(["available", "native", "observe"])(
  "startup falls through a failed %s before migrations or data access",
  async (stage) => {
    const primary = createMockAdapter();
    const fallback = createMockAdapter();
    const failure = new Error("SDK unavailable");
    let report: (change: StorageChange) => void = () => {};
    const broken = {
      ...primary.adapter,
      available: () => {
        if (stage === "available") {
          throw failure;
        }
        return true;
      },
      get native() {
        if (stage === "native") {
          throw failure;
        }
        return primary.adapter.native;
      },
      observe: (listener: (change: StorageChange) => void) => {
        report = listener;
        throw failure;
      },
    };
    const silo = new Silo({
      storages: {
        default: { adapters: [broken, fallback.adapter], schema: Schema },
      },
      migrations: { 1: (store) => store.set("count", 4) },
    });
    await silo.ready();
    const count = silo.value("count");
    expect(silo.native.default).toBe(fallback.adapter.native);
    expect(primary.calls).toEqual([]);
    expect(primary.disposeCount()).toBe(1);
    expect(count.get()).toBe(4);
    report({ key: "silo:count", value: 99 });
    expect(count.get()).toBe(4);
    silo.dispose();
    expect(fallback.disposeCount()).toBe(1);
  },
);

test("exhausted candidates retain each initialization cause", () => {
  const first = createMockAdapter();
  const second = createMockAdapter();
  const failure = new Error("native unavailable");
  vi.spyOn(first.adapter, "available").mockImplementation(() => {
    throw failure;
  });
  vi.spyOn(second.adapter, "available").mockReturnValue(false);
  expect(
    () =>
      new Silo({
        storages: {
          default: {
            adapters: [first.adapter, second.adapter],
            schema: Schema,
          },
        },
      }),
  ).toThrow(
    expect.objectContaining({
      message: 'No adapter could initialize storage "default".',
      errors: [
        expect.objectContaining({ cause: failure }),
        expect.objectContaining({ message: 'Adapter "mock" is unavailable.' }),
      ],
    }),
  );
  expect(first.disposeCount()).toBe(1);
  expect(second.disposeCount()).toBe(1);
});

test.each(["sync", "async"])(
  "reload recovers a failed first read (%s)",
  async (mode) => {
    const mock =
      mode === "async" ? createMockAdapter({ mode }) : createMockAdapter();
    const failure = new Error("temporarily unavailable");
    const read = vi.spyOn(mock.adapter, "get").mockImplementationOnce(() => {
      throw failure;
    });
    const silo = createSilo(mock.adapter);
    const count = silo.value("count");
    await count.hydrated();
    expect(count.status.get()).toEqual({
      state: "error",
      error: { phase: "hydrate", cause: failure },
    });
    mock.store.set("silo:count", 7);
    await count.reload();
    expect(read).toHaveBeenCalledTimes(2);
    expect(count.get()).toBe(7);
    expect(count.status.get()).toEqual({ state: "ready" });
    expect(silo.value("count")).toBe(count);
    silo.dispose();
  },
);

test.each(["sync", "async"])(
  "reload preserves the current value on failure and rejects (%s)",
  async (mode) => {
    const mock =
      mode === "async" ? createMockAdapter({ mode }) : createMockAdapter();
    mock.store.set("silo:count", 3);
    const silo = createSilo(mock.adapter);
    const count = silo.value("count");
    await count.hydrated();
    const failure = new Error("read denied");
    vi.spyOn(mock.adapter, "get").mockImplementationOnce(() => {
      throw failure;
    });
    await expect(count.reload()).rejects.toBe(failure);
    expect(count.get()).toBe(3);
    expect(count.status.get()).toEqual({
      state: "error",
      error: { phase: "read", cause: failure },
    });
    await count.reload();
    expect(count.status.get()).toEqual({ state: "ready" });
    silo.dispose();
  },
);

test("reload joins an initial read and concurrent reloads share one operation", async () => {
  const mock = createMockAdapter({ mode: "async", hold: true });
  const silo = createSilo(mock.adapter);
  const count = silo.value("count");
  const first = count.reload();
  expect(count.reload()).toBe(first);
  expect(mock.calls).toHaveLength(1);
  mock.calls[0]?.fail(new Error("offline"));
  await expect(first).rejects.toThrow("offline");
  await count.hydrated();
  expect(count.status.get()).toMatchObject({ error: { phase: "hydrate" } });
  silo.dispose();
});

test("reload waits for writes and cannot replace a newer local mutation", async () => {
  const mock = createMockAdapter({ mode: "async", hold: true });
  const silo = createSilo(mock.adapter);
  const count = silo.value("count");
  count.set(1);
  const reloaded = count.reload();
  expect(mock.calls.map(({ operation }) => operation)).toEqual(["get", "set"]);
  mock.calls[1]?.settle();
  await vi.waitFor(() => expect(mock.calls).toHaveLength(3));
  count.set(2);
  await reloaded;
  mock.calls[2]?.settle();
  mock.calls[0]?.settle();
  mock.calls[3]?.settle();
  await count.flush();
  expect(count.get()).toBe(2);
  expect(mock.store.get("silo:count")).toBe(2);
  silo.dispose();
});

test("reload refuses to overwrite an unsaved snapshot after a failed write", async () => {
  const mock = createMockAdapter();
  const silo = createSilo(mock.adapter);
  const count = silo.value("count");
  const failure = new Error("quota");
  vi.spyOn(mock.adapter, "set").mockImplementationOnce(() => {
    throw failure;
  });
  count.set(9);
  const reads = mock.calls.filter(
    ({ operation }) => operation === "get",
  ).length;
  await expect(count.reload()).rejects.toBe(failure);
  expect(count.get()).toBe(9);
  expect(
    mock.calls.filter(({ operation }) => operation === "get"),
  ).toHaveLength(reads);
  count.set(count.get());
  await count.reload();
  expect(count.get()).toBe(9);
  silo.dispose();
});

test.each(["release", "dispose"])(
  "%s cancels an outstanding reload",
  async (operation) => {
    const mock = createMockAdapter({ mode: "async", hold: true });
    const silo = createSilo(mock.adapter);
    const count = silo.value("count");
    mock.calls[0]?.settle();
    await count.hydrated();
    const reloaded = count.reload();
    if (operation === "release") {
      await silo.release();
    } else {
      silo.dispose();
    }
    await expect(reloaded).rejects.toThrow(
      operation === "release" ? "released" : "disposed",
    );
    await expect(count.reload()).rejects.toThrow(
      operation === "release" ? "released" : "disposed",
    );
    mock.store.set("silo:count", 99);
    mock.calls[1]?.settle();
    await Promise.resolve();
    expect(count.get()).toBe(0);
    silo.dispose();
  },
);

test("a valid external change supersedes a pending reload", async () => {
  const mock = createMockAdapter({ mode: "async", hold: true });
  const silo = createSilo(mock.adapter);
  const count = silo.value("count");
  mock.calls[0]?.settle();
  await count.hydrated();
  const reloaded = count.reload();
  mock.emit({ key: "silo:count", value: 8 });
  await reloaded;
  mock.calls[1]?.fail(new Error("stale failure"));
  await Promise.resolve();
  expect(count.get()).toBe(8);
  expect(count.status.get()).toEqual({ state: "ready" });
  silo.dispose();
});

test("malformed external text reaches status and diagnostics without replacing data", async () => {
  const raw = new Map([["silo:count", "3"]]);
  let emit: (change: TextStorageChange) => void = () => {};
  const adapter = createTextStorageAdapter({
    mode: "sync",
    name: "text",
    native: raw,
    available: () => true,
    dispose: () => {},
    read: (key) => raw.get(key),
    write: (key, text) => {
      raw.set(key, text);
    },
    remove: (key) => {
      raw.delete(key);
    },
    observe: (listener) => {
      emit = listener;
      return () => {};
    },
  });
  const silo = createSilo(adapter);
  const event = vi.fn();
  silo.diagnostics.events.subscribe(event);
  const count = silo.value("count");
  raw.set("silo:count", "broken");
  emit({ key: "silo:count", text: "broken" });
  expect(count.get()).toBe(3);
  expect(count.status.get()).toEqual({
    state: "error",
    error: { phase: "read", cause: expect.any(SyntaxError) },
  });
  expect(event).toHaveBeenCalledWith(
    expect.objectContaining({
      type: "observation failed",
      context: { cause: expect.any(SyntaxError) },
    }),
  );
  expect(raw.get("silo:count")).toBe("broken");
  raw.set("silo:count", "4");
  await count.reload();
  expect(count.get()).toBe(4);
  expect(count.status.get()).toEqual({ state: "ready" });
  silo.dispose();
});

test("storage-wide observation errors affect existing records without creating demand", () => {
  const mock = createMockAdapter();
  const silo = new Silo({
    storages: {
      default: {
        adapters: [mock.adapter],
        schema: { ...Schema, unseen: value() },
      },
    },
  });
  const count = silo.value("count");
  const failure = new Error("observer disconnected");
  mock.emit({ key: null, error: { cause: failure } });
  expect(count.status.get()).toEqual({
    state: "error",
    error: { phase: "read", cause: failure },
  });
  expect(mock.calls).toHaveLength(1);
  expect(silo.diagnostics.get().records).toHaveLength(1);
  silo.dispose();
});

test("an observation error does not interrupt hydration or replace a write failure", async () => {
  const mock = createMockAdapter({ mode: "async", hold: true });
  const silo = createSilo(mock.adapter);
  const count = silo.value("count");
  mock.emit({ key: "silo:count", error: { cause: new Error("read failed") } });
  expect(count.status.get()).toEqual({ state: "hydrating" });
  mock.calls[0]?.settle();
  await count.hydrated();
  count.set(5);
  mock.calls[1]?.fail(new Error("write failed"));
  await expect(count.flush()).rejects.toThrow("write failed");
  mock.emit({ key: "silo:count", error: { cause: new Error("read failed") } });
  expect(count.get()).toBe(5);
  expect(count.status.get()).toMatchObject({ error: { phase: "write" } });
  silo.dispose();
});

test("a coarse change replaces a pending reload without settling it early", async () => {
  const mock = createMockAdapter({ mode: "async", hold: true });
  const silo = createSilo(mock.adapter);
  const count = silo.value("count");
  mock.calls[0]?.settle();
  await count.hydrated();
  const reloaded = count.reload();
  const completed = vi.fn();
  reloaded.then(completed);
  mock.emit({ key: null });
  mock.calls[1]?.settle();
  await Promise.resolve();
  expect(completed).not.toHaveBeenCalled();
  mock.store.set("silo:count", 6);
  mock.calls[2]?.settle();
  await reloaded;
  expect(count.get()).toBe(6);
  silo.dispose();
});

test("disposal inside a reload diagnostic callback rejects its waiter", async () => {
  const mock = createMockAdapter();
  const silo = createSilo(mock.adapter);
  const count = silo.value("count");
  silo.diagnostics.events.subscribe((event) => {
    if (event.type === "outside applied") {
      silo.dispose();
    }
  });
  await expect(count.reload()).rejects.toThrow("disposed");
});

test("an error diagnostic listener can recover without having its write replaced", () => {
  const mock = createMockAdapter();
  const silo = createSilo(mock.adapter);
  const count = silo.value("count");
  silo.diagnostics.events.subscribe((event) => {
    if (event.type === "outside dropped") {
      count.set(9);
    }
  });
  mock.emit({ key: "silo:count", error: { cause: new Error("read failed") } });
  expect(count.get()).toBe(9);
  expect(count.status.get()).toEqual({ state: "ready" });
  silo.dispose();
});
