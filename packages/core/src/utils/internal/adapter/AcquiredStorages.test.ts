import { expect, test, vi } from "vitest";
import { createMockAdapter } from "src/mock/createMockAdapter";
import type { StorageAdapter } from "src/types/StorageAdapter";
import { AcquiredStorages } from "src/utils/internal/adapter/AcquiredStorages";

const acquire = (adapters: StorageAdapter[]) =>
  new AcquiredStorages({ default: { adapters, schema: {} } });

test("the first available candidate is kept and unused candidates are released", () => {
  const blocked = createMockAdapter({ available: false });
  const chosen = createMockAdapter();
  const spare = createMockAdapter();
  const { backends, dispose } = acquire([
    blocked.adapter,
    chosen.adapter,
    spare.adapter,
  ]);
  expect(backends.default.adapter).toBe(chosen.adapter);
  expect(backends.default.execution.mode).toBe("sync");
  expect([
    blocked.disposeCount(),
    chosen.disposeCount(),
    spare.disposeCount(),
  ]).toEqual([1, 0, 1]);
  dispose();
  expect([
    blocked.disposeCount(),
    chosen.disposeCount(),
    spare.disposeCount(),
  ]).toEqual([1, 1, 1]);
});

test("the last candidate is an unconditional fallback and is never probed", () => {
  const blocked = createMockAdapter({ available: false });
  const fallback = createMockAdapter();
  const probe = vi.spyOn(fallback.adapter, "available");
  const { backends, dispose } = acquire([blocked.adapter, fallback.adapter]);
  expect(backends.default.adapter).toBe(fallback.adapter);
  expect(probe).not.toHaveBeenCalled();
  dispose();
});

test("a single candidate is used without probing it", () => {
  const mock = createMockAdapter({ available: false });
  const probe = vi.spyOn(mock.adapter, "available");
  const { backends, dispose } = acquire([mock.adapter]);
  expect(backends.default.adapter).toBe(mock.adapter);
  expect(probe).not.toHaveBeenCalled();
  dispose();
  expect(() => acquire([])).toThrow("A Silo needs at least one adapter.");
});

test("a mixed list preserves the selected adapter and settles its operations asynchronously", async () => {
  const unavailable = createMockAdapter({ mode: "async", available: false });
  const chosen = createMockAdapter();
  const { backends, native, dispose } = acquire([
    unavailable.adapter,
    chosen.adapter,
  ]);
  const backend = backends.default;
  expect(backend.adapter).toBe(chosen.adapter);
  expect(backend.execution.mode).toBe("async");
  expect(native.default).toBe(chosen.adapter.native);
  const done = vi.fn();
  const error = vi.fn();
  backend.set("silo:theme", "dark", { done, error });
  expect(done).not.toHaveBeenCalled();
  await Promise.resolve();
  expect(done).toHaveBeenCalledOnce();
  expect(error).not.toHaveBeenCalled();
  expect(chosen.store.get("silo:theme")).toBe("dark");
  dispose();
});

test("an asynchronous candidate keeps its identity and execution mode", () => {
  const mock = createMockAdapter({ mode: "async" });
  const { backends, dispose } = acquire([mock.adapter]);
  expect(backends.default.adapter).toBe(mock.adapter);
  expect(backends.default.execution.mode).toBe("async");
  dispose();
});

test("an unused asynchronous fallback still determines the execution mode", () => {
  const chosen = createMockAdapter();
  const fallback = createMockAdapter({ mode: "async" });
  const { backends, dispose } = acquire([chosen.adapter, fallback.adapter]);
  expect(backends.default.adapter).toBe(chosen.adapter);
  expect(backends.default.execution.mode).toBe("async");
  expect(fallback.disposeCount()).toBe(1);
  dispose();
});

test("a failed constructor releases selected and unvisited candidates", () => {
  const chosen = createMockAdapter();
  const broken = createMockAdapter();
  const spare = createMockAdapter();
  vi.spyOn(broken.adapter, "available").mockImplementation(() => {
    throw new Error("probe failed");
  });

  expect(
    () =>
      new AcquiredStorages({
        default: { adapters: [chosen.adapter], schema: {} },
        other: { adapters: [broken.adapter, spare.adapter], schema: {} },
      }),
  ).toThrow("probe failed");
  expect([
    chosen.disposeCount(),
    broken.disposeCount(),
    spare.disposeCount(),
  ]).toEqual([1, 1, 1]);
});

test("failed unused-candidate cleanup rolls back the rest without retrying it", () => {
  const chosen = createMockAdapter();
  const broken = createMockAdapter();
  const spare = createMockAdapter();
  const cleanup = vi.spyOn(broken.adapter, "dispose").mockImplementation(() => {
    throw new Error("cleanup failed");
  });

  expect(() =>
    acquire([chosen.adapter, broken.adapter, spare.adapter]),
  ).toThrow("cleanup failed");
  expect(cleanup).toHaveBeenCalledOnce();
  expect(chosen.disposeCount()).toBe(1);
  expect(spare.disposeCount()).toBe(1);
});

test("a shared candidate stays alive until disposal and is released only once", () => {
  const shared = createMockAdapter();
  const other = createMockAdapter();
  const storages = new AcquiredStorages({
    default: { adapters: [shared.adapter], schema: {} },
    other: { adapters: [other.adapter, shared.adapter], schema: {} },
  });

  expect(shared.disposeCount()).toBe(0);
  expect(storages.native.default.store).toBe(shared.store);
  expect(storages.native.other.store).toBe(other.store);
  storages.dispose();
  storages.dispose();
  expect(shared.disposeCount()).toBe(1);
  expect(other.disposeCount()).toBe(1);
});

test("a prototype property name is acquired as an ordinary storage", () => {
  const primary = createMockAdapter();
  const named = createMockAdapter();
  const storages = new AcquiredStorages({
    default: { adapters: [primary.adapter], schema: {} },
    ["__proto__"]: { adapters: [named.adapter], schema: {} },
  });

  expect(named.disposeCount()).toBe(0);
  expect(Object.hasOwn(storages.backends, "__proto__")).toBe(true);
  expect(Object.hasOwn(storages.native, "__proto__")).toBe(true);
  expect(storages.backends.__proto__?.adapter).toBe(named.adapter);
  expect(storages.native.__proto__).toBe(named.adapter.native);
  storages.dispose();
  expect(named.disposeCount()).toBe(1);
});
