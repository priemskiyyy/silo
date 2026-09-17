import { expect, test, vi } from "vitest";
import { createMockAdapter } from "src/mock/createMockAdapter";
import { deferred } from "src/utils/common/deferred";
import { Silo } from "src/utils/Silo";
import { value } from "src/utils/value";

test("status listeners see the committed snapshot and can replace it", async () => {
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
  const seen: unknown[] = [];
  count.status.subscribe(() => {
    seen.push(count.get());
    count.set(2);
  });
  count.set(1);

  expect(seen).toEqual([1]);
  expect(count.get()).toBe(2);
  mock.calls.find((call) => call.operation === "set")?.settle();
  await new Promise((resolve) => setTimeout(resolve, 0));
  mock.calls.filter((call) => call.pending).forEach((call) => call.settle());
  await count.flush();
  expect(mock.store.get("silo:count")).toBe(2);
  silo.dispose();
});

test("a synchronous write failure publishes its optimistic value before recovery", async () => {
  const mock = createMockAdapter({
    onCall: (call) => {
      if (call.operation === "set" && call.value === 1) {
        throw new Error("refused");
      }
    },
  });
  const silo = new Silo({
    storages: {
      default: {
        adapters: [mock.adapter],
        schema: { count: value({ fallback: 0 }) },
      },
    },
  });
  const count = silo.value("count");
  const seen: unknown[] = [];
  count.status.subscribe(() => {
    seen.push(count.get());
    if (count.status.get().state === "error") {
      count.set(2);
    }
  });
  count.set(1);

  expect(seen).toEqual([1, 2]);
  expect(count.get()).toBe(2);
  expect(mock.store.get("silo:count")).toBe(2);
  await count.flush();
  silo.dispose();
});

test("an outside reload begun during a write cannot restore stale data", async () => {
  const mock = createMockAdapter({ mode: "async", hold: true });
  const delayed = deferred<unknown>();
  const get = vi.fn(mock.adapter.get);
  const silo = new Silo({
    storages: {
      default: {
        adapters: [{ ...mock.adapter, get }],
        schema: { count: value({ fallback: 0 }) },
      },
    },
  });
  const count = silo.value("count");
  mock.calls[0]?.settle();
  await count.hydrated();
  get.mockImplementation(() => delayed.promise);

  count.set(1);
  mock.emit({ key: null });
  mock.calls.find((call) => call.operation === "set")?.settle();
  await count.flush();
  delayed.resolve(0);
  await new Promise((resolve) => setTimeout(resolve, 0));

  expect(count.get()).toBe(1);
  expect(mock.store.get("silo:count")).toBe(1);
  silo.dispose();
});

test("invalid outside data does not cancel initial hydration", async () => {
  const mock = createMockAdapter({ mode: "async", hold: true });
  mock.store.set("silo:name", "stored");
  const silo = new Silo({
    storages: {
      default: {
        adapters: [mock.adapter],
        schema: {
          name: value({
            fallback: "fallback",
            codec: {
              encode: (name: string) => name,
              decode: (raw: unknown) => {
                if (typeof raw !== "string") {
                  throw new Error("Expected string");
                }
                return raw;
              },
            },
          }),
        },
      },
    },
  });
  const name = silo.value("name");
  mock.emit({ key: "silo:name", value: 42 });
  mock.calls[0]?.settle();
  await name.hydrated();

  expect(name.get()).toBe("stored");
  expect(name.status.get()).toEqual({ state: "ready" });
  silo.dispose();
});

test("disposal inside a status callback stops the remaining notifications", () => {
  const mock = createMockAdapter({ mode: "async" });
  const silo = new Silo({
    storages: {
      default: {
        adapters: [mock.adapter],
        schema: { count: value({ fallback: 0 }) },
      },
    },
  });
  const count = silo.value("count");
  const notified = vi.fn();
  count.status.subscribe(silo.dispose);
  count.subscribe(notified);
  count.set(1);

  expect(notified).not.toHaveBeenCalled();
});

test("reloads waiting for migrations hydrate once from the migrated value", async () => {
  const mock = createMockAdapter({ mode: "async" });
  const migration = deferred();
  const silo = new Silo({
    storages: {
      default: {
        adapters: [mock.adapter],
        schema: { count: value({ fallback: 0 }) },
      },
    },
    migrations: { 1: () => migration.promise },
  });
  const count = silo.value("count");
  mock.emit({ key: null });
  mock.emit({ key: null });
  expect(mock.calls.some((call) => call.key === "silo:count")).toBe(false);

  mock.store.set("silo:count", 7);
  migration.resolve();
  await count.hydrated();

  expect(count.get()).toBe(7);
  expect(mock.calls.filter((call) => call.key === "silo:count")).toHaveLength(
    1,
  );
  silo.dispose();
});

test("migration failure settles waiting hydration and preserves an optimistic write", async () => {
  const mock = createMockAdapter({ mode: "async" });
  const migration = deferred();
  const failure = new Error("migration failed");
  const silo = new Silo({
    storages: {
      default: {
        adapters: [mock.adapter],
        schema: {
          waiting: value({ fallback: 0 }),
          edited: value({ fallback: 0 }),
        },
      },
    },
    migrations: { 1: () => migration.promise },
  });
  const waiting = silo.value("waiting");
  const edited = silo.value("edited");
  edited.set(9);
  const flushed = edited.flush();
  migration.reject(failure);

  await expect(silo.ready()).rejects.toBe(failure);
  await waiting.hydrated();
  await expect(flushed).rejects.toBe(failure);
  expect(waiting.get()).toBe(0);
  expect(waiting.status.get()).toEqual({
    state: "error",
    error: { phase: "hydrate", cause: failure },
  });
  expect(edited.get()).toBe(9);
  expect(edited.status.get()).toEqual({
    state: "error",
    error: { phase: "write", cause: failure },
  });
  expect(mock.calls.map((call) => call.key)).toEqual(["silo::version"]);
  silo.dispose();
});

test.each(["silo:count", null])(
  "a write inside decoding supersedes the inbound value (key: %s)",
  (key) => {
    const mock = createMockAdapter();
    let handleDecode = () => {};
    const silo = new Silo({
      storages: {
        default: {
          adapters: [mock.adapter],
          schema: {
            count: value({
              fallback: 0,
              codec: {
                encode: (count: number) => count,
                decode: (raw: unknown) => {
                  handleDecode();
                  return Number(raw);
                },
              },
            }),
          },
        },
      },
    });
    const count = silo.value("count");
    handleDecode = () => count.set(7);
    const events: string[] = [];
    silo.diagnostics.events.subscribe((event) => events.push(event.type));

    mock.store.set("silo:count", 1);
    mock.emit(key === null ? { key } : { key, value: 1 });

    expect(count.get()).toBe(7);
    expect(mock.store.get("silo:count")).toBe(7);
    expect(events).toEqual(["write accepted", "write durable"]);
    silo.dispose();
  },
);

test("hydrated can first be observed after settlement or after cancellation", async () => {
  const mock = createMockAdapter({ mode: "async", hold: true });
  const silo = new Silo({
    storages: {
      default: {
        adapters: [mock.adapter],
        schema: { count: value({ fallback: 0 }) },
      },
    },
  });
  const completed = silo.value("count");
  mock.calls[0]?.settle();
  await new Promise((resolve) => setTimeout(resolve, 0));
  const cancelled = silo.scope("cancelled").value("count");
  silo.dispose();
  await expect(completed.hydrated()).resolves.toBeUndefined();
  await expect(cancelled.hydrated()).rejects.toThrow("finished hydrating");
  mock.calls.filter((call) => call.pending).forEach((call) => call.settle());
});

test("scoped codecs use the current clock and never share a different store's clock", async () => {
  let now = 1_000;
  const schema = { count: value({ fallback: 0, expires: { in: 100 } }) };
  const primary = createMockAdapter();
  const secondary = createMockAdapter();
  const silo = new Silo({
    storages: { default: { adapters: [primary.adapter], schema } },
    now: () => now,
  });
  const other = new Silo({
    storages: { default: { adapters: [secondary.adapter], schema } },
    now: () => 5_000,
  });
  silo.value("count").set(1);
  now = 1_050;
  silo.scope("account").value("count").set(2);
  other.value("count").set(3);
  expect(primary.store.get("silo:count")).toEqual({
    value: 1,
    expires: { at: 1_100 },
  });
  expect(primary.store.get("silo:account:count")).toEqual({
    value: 2,
    expires: { at: 1_150 },
  });
  expect(secondary.store.get("silo:count")).toEqual({
    value: 3,
    expires: { at: 5_100 },
  });
  await silo.release();
  now = 1_120;
  expect(silo.value("count").get()).toBe(0);
  expect(silo.scope("account").value("count").get()).toBe(2);
  expect(other.value("count").get()).toBe(3);
  silo.dispose();
  other.dispose();
});
