import { expect, test, vi } from "vitest";
import { createMockAdapter } from "src/mock/createMockAdapter";
import { Silo } from "src/utils/Silo";
import { value } from "src/utils/value";

test("invalid schema cannot run migrations or advance the version", () => {
  const mock = createMockAdapter();
  const migration = vi.fn();
  expect(
    () =>
      new Silo({
        storages: {
          default: { adapters: [mock.adapter], schema: { "bad.key": value() } },
        },
        migrations: { 1: migration },
      }),
  ).toThrow("schema key");
  expect(migration).not.toHaveBeenCalled();
  expect(mock.calls).toEqual([]);
});

test("a failed native acquisition releases every candidate exactly once", () => {
  const first = createMockAdapter();
  const second = createMockAdapter();
  const broken = {
    ...second.adapter,
    get native() {
      throw new Error("native unavailable");
    },
  };
  expect(
    () =>
      new Silo({
        storages: {
          default: { adapters: [first.adapter], schema: {} },
          other: { adapters: [broken], schema: {} },
        },
      }),
  ).toThrow("native unavailable");
  expect(first.disposeCount()).toBe(1);
  expect(second.disposeCount()).toBe(1);
});

test("a disposed store refuses fresh records and clears without touching storage", async () => {
  const mock = createMockAdapter();
  const silo = new Silo({
    storages: {
      default: {
        adapters: [mock.adapter],
        schema: { count: value({ fallback: 0 }) },
      },
    },
  });
  const scope = silo.scope("account");
  silo.dispose();

  expect(() => silo.value("count")).toThrow("disposed");
  expect(() => scope.value("count")).toThrow("disposed");
  await expect(silo.clear()).rejects.toThrow("disposed");
  await expect(scope.clear()).rejects.toThrow("disposed");
  expect(mock.calls).toEqual([]);
});

test("disposal settles pending barriers and prevents queued writes after teardown", async () => {
  const mock = createMockAdapter({ mode: "async", hold: true });
  const silo = new Silo({
    storages: {
      default: {
        adapters: [mock.adapter],
        schema: { count: value({ fallback: 0 }) },
      },
    },
  });
  const count = silo.value("count");
  count.set(1);
  count.set(2);
  const flushed = count.flush();
  silo.dispose();
  await expect(flushed).rejects.toThrow("disposed");
  mock.calls.filter((call) => call.pending).forEach((call) => call.settle());
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(
    mock.calls.flatMap((call) => {
      if (call.operation !== "set") {
        return [];
      }
      return [call.value];
    }),
  ).toEqual([1]);
});

test("disposing during migrations rejects ready and stops later migration steps", async () => {
  const mock = createMockAdapter({ mode: "async", hold: true });
  const migration = vi.fn();
  const silo = new Silo({
    storages: { default: { adapters: [mock.adapter], schema: {} } },
    migrations: { 1: migration },
  });
  const notified = vi.fn();
  silo.status.subscribe(notified);
  silo.dispose();
  await expect(silo.ready()).rejects.toThrow("disposed");
  mock.calls.filter((call) => call.pending).forEach((call) => call.settle());
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(migration).not.toHaveBeenCalled();
  expect(notified).not.toHaveBeenCalled();
});

test("an async version read that throws still reports failure asynchronously", async () => {
  const mock = createMockAdapter({ mode: "async" });
  const failure = new Error("version unavailable");
  const migrate = vi.fn();
  const silo = new Silo({
    storages: {
      default: {
        adapters: [
          {
            ...mock.adapter,
            get: () => {
              throw failure;
            },
          },
        ],
        schema: {},
      },
    },
    migrations: { 1: migrate },
  });

  expect(silo.status.get()).toEqual({ state: "migrating" });
  await expect(silo.ready()).rejects.toBe(failure);
  expect(silo.status.get()).toEqual({
    state: "error",
    error: { phase: "migrate", cause: failure },
  });
  expect(migrate).not.toHaveBeenCalled();
  silo.dispose();
});

test("a failed availability probe releases selected, unvisited, and rejected candidates", () => {
  const first = createMockAdapter();
  const second = createMockAdapter();
  const spare = createMockAdapter();
  expect(
    () =>
      new Silo({
        storages: {
          default: { adapters: [first.adapter], schema: {} },
          other: {
            adapters: [
              {
                ...second.adapter,
                available: () => {
                  throw new Error("probe failed");
                },
              },
              spare.adapter,
            ],
            schema: {},
          },
        },
      }),
  ).toThrow("probe failed");
  expect([
    first.disposeCount(),
    second.disposeCount(),
    spare.disposeCount(),
  ]).toEqual([1, 1, 1]);
});

test("a candidate shared across storages stays alive when selected anywhere", () => {
  const shared = createMockAdapter();
  const other = createMockAdapter();
  const silo = new Silo({
    storages: {
      default: {
        adapters: [shared.adapter],
        schema: { count: value({ fallback: 0 }) },
      },
      other: { adapters: [other.adapter, shared.adapter], schema: {} },
    },
  });
  expect(shared.disposeCount()).toBe(0);
  silo.value("count").set(1);
  expect(shared.store.get("silo:count")).toBe(1);
  silo.dispose();
  expect(shared.disposeCount()).toBe(1);
  expect(other.disposeCount()).toBe(1);
});

test("disposal during a migration prevents its version write and the next step", async () => {
  const mock = createMockAdapter({ mode: "async" });
  let resume = () => {};
  const waiting = new Promise<void>((resolve) => {
    resume = resolve;
  });
  const next = vi.fn();
  const silo = new Silo({
    storages: { default: { adapters: [mock.adapter], schema: {} } },
    migrations: { 1: () => waiting, 2: next },
  });
  await new Promise((resolve) => setTimeout(resolve, 0));
  silo.dispose();
  resume();
  await expect(silo.ready()).rejects.toThrow("disposed");
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(next).not.toHaveBeenCalled();
  expect(mock.calls.filter((call) => call.operation === "set")).toEqual([]);
});

test("disposing from the ready notification preserves completed migration readiness", async () => {
  const mock = createMockAdapter({ mode: "async" });
  const silo = new Silo({
    storages: { default: { adapters: [mock.adapter], schema: {} } },
    migrations: { 1: () => {} },
  });
  silo.status.subscribe(() => {
    if (silo.status.get().state === "ready") {
      silo.dispose();
    }
  });
  await expect(silo.ready()).resolves.toBeUndefined();
  expect(mock.disposeCount()).toBe(1);
});

test.each(["sync", "async"])(
  "migration moves between aliases of one adapter preserve the value (%s)",
  async (mode) => {
    const mock =
      mode === "async"
        ? createMockAdapter({ mode: "async" })
        : createMockAdapter();
    mock.store.set("silo:token", "keep");
    const silo = new Silo({
      storages: {
        default: { adapters: [mock.adapter], schema: {} },
        other: { adapters: [mock.adapter], schema: {} },
      },
      migrations: { 1: (store) => store.move("token", { to: "other" }) },
    });

    await silo.ready();
    expect(mock.store.get("silo:token")).toBe("keep");
    expect(mock.calls.some((call) => call.operation === "remove")).toBe(false);
    silo.dispose();
  },
);

test("a rejected synchronous migration is contained and cannot advance the version", async () => {
  const mock = createMockAdapter();
  const later = vi.fn();
  const silo = new Silo({
    storages: { default: { adapters: [mock.adapter], schema: {} } },
    migrations: {
      1: () => Promise.reject(new Error("migration rejected")),
      2: later,
    },
  });

  await expect(silo.ready()).rejects.toThrow("cannot await migration 1");
  await new Promise((resolve) => setImmediate(resolve));
  expect(later).not.toHaveBeenCalled();
  expect(mock.store.has("silo::version")).toBe(false);
  silo.dispose();
});
