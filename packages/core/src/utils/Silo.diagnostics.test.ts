import { expect, test, vi } from "vitest";
import type { SiloDiagnosticEvent } from "src/types/SiloDiagnosticEvent";
import { createMockAdapter } from "src/mock/createMockAdapter";
import { Silo } from "src/utils/Silo";
import { value } from "src/utils/value";

const schema = { theme: value({ fallback: "light" }) };

const macrotask = () => new Promise((resolve) => setTimeout(resolve, 0));

const record = (silo: Silo, events: SiloDiagnosticEvent[]) =>
  silo.diagnostics.events.subscribe((event) => events.push(event));

const types = (events: SiloDiagnosticEvent[]) =>
  events.map((event) => event.type);

test("the snapshot names each storage's winner, mode and namespace, and reading it creates no demand", () => {
  const local = createMockAdapter();
  const secure = createMockAdapter({ mode: "async" });
  const silo = new Silo({
    namespace: "app",
    storages: {
      default: { adapters: [local.adapter], schema },
      secure: {
        adapters: [secure.adapter],
        schema: { token: value<string>() },
        namespace: "",
      },
    },
  });

  const snapshot = silo.diagnostics.get();

  expect(snapshot.status).toEqual({ state: "ready" });
  expect(snapshot.version).toEqual({ declared: 0, stored: null });
  expect(snapshot.storages).toEqual([
    { name: "default", adapter: "mock", mode: "sync", namespace: "app" },
    { name: "secure", adapter: "mock", mode: "async", namespace: "" },
  ]);
  expect(snapshot.records).toEqual([]);
  expect(local.calls).toEqual([]);
  expect(secure.calls).toEqual([]);
  silo.dispose();
});

test("a record appears once reached, with its identity, snapshot and write counters", async () => {
  const mock = createMockAdapter({ mode: "async", hold: true });
  const silo = new Silo({
    storages: { default: { adapters: [mock.adapter], schema } },
  });
  const theme = silo.scope("users:7").value("theme");
  const before = silo.diagnostics.get();

  expect(before.records).toEqual([
    {
      storage: "default",
      path: "theme",
      segments: ["users:7"],
      physicalKey: "silo:users:7:theme",
      status: { state: "hydrating" },
      value: "light",
      writes: { accepted: 0, durable: 0, inflight: false },
    },
  ]);

  theme.set("dark");

  expect(silo.diagnostics.get().records[0]?.writes).toEqual({
    accepted: 1,
    durable: 0,
    inflight: true,
  });

  mock.calls.filter((call) => call.pending).forEach((call) => call.settle());
  await macrotask();

  expect(silo.diagnostics.get().records[0]?.writes).toEqual({
    accepted: 1,
    durable: 1,
    inflight: false,
  });
  expect(silo.diagnostics.get().records[0]?.value).toBe("dark");
  silo.dispose();
});

test("changes notify once per microtask and events say what happened, in order", async () => {
  const mock = createMockAdapter();
  mock.store.set("silo:theme", "dark");
  const silo = new Silo({
    storages: { default: { adapters: [mock.adapter], schema } },
  });
  const events: SiloDiagnosticEvent[] = [];
  let notifications = 0;
  record(silo, events);
  silo.diagnostics.subscribe(() => {
    notifications += 1;
  });

  const theme = silo.value("theme");
  theme.set("light");
  theme.set("dim");
  await macrotask();

  expect(notifications).toBe(1);
  expect(types(events)).toEqual([
    "record created",
    "hydrate landed",
    "write accepted",
    "write durable",
    "write accepted",
    "write durable",
  ]);
  expect(events[1]).toMatchObject({
    source: "value",
    storage: "default",
    key: "silo:theme",
    context: { outcome: "value" },
  });
  silo.dispose();
});

test("a refused write, an outside change and a dropped one are each an event", () => {
  const mock = createMockAdapter({
    onCall: (call) => {
      if (call.operation === "set" && call.value === "refused") {
        throw new Error("quota");
      }
    },
  });
  const silo = new Silo({
    storages: { default: { adapters: [mock.adapter], schema } },
  });
  const events: SiloDiagnosticEvent[] = [];
  record(silo, events);
  const theme = silo.value("theme");

  theme.set("refused");
  mock.emit({ key: "silo:theme", value: "outside" });
  mock.emit({ key: "silo:other", value: "nobody" });

  expect(types(events)).toEqual([
    "record created",
    "hydrate landed",
    "write accepted",
    "write refused",
    "outside applied",
  ]);
  expect(theme.get()).toBe("outside");
  silo.dispose();
});

test("migrations report each step and version, and disposal is the last event", () => {
  const mock = createMockAdapter();
  mock.store.set("silo::version", 1);
  const silo = new Silo({
    storages: { default: { adapters: [mock.adapter], schema } },
    migrations: { 2: () => undefined, 3: () => undefined },
  });
  const events: SiloDiagnosticEvent[] = [];
  record(silo, events);

  // Migrations ran inside the constructor, before anyone could listen; the
  // snapshot carries what they left behind.
  expect(silo.diagnostics.get().version).toEqual({ declared: 3, stored: 3 });

  silo.dispose();

  expect(types(events)).toEqual(["store disposed"]);
});

test("an asynchronous chain reports live", async () => {
  const mock = createMockAdapter({ mode: "async" });
  const silo = new Silo({
    storages: { default: { adapters: [mock.adapter], schema } },
    migrations: { 2: async () => undefined },
  });
  const events: SiloDiagnosticEvent[] = [];
  record(silo, events);

  expect(silo.diagnostics.get().version).toEqual({ declared: 2, stored: null });

  await silo.ready();

  expect(types(events)).toEqual([
    "migration version",
    "migration step",
    "migration version",
    "migration done",
  ]);
  expect(silo.diagnostics.get().version).toEqual({ declared: 2, stored: 2 });
  silo.dispose();
});

test.each(["silo:theme", null])(
  "keyed changes and reloads report the same acceptance decisions (key: %s)",
  (key) => {
    const mock = createMockAdapter();
    const silo = new Silo({
      storages: {
        default: {
          adapters: [mock.adapter],
          schema: {
            theme: value({
              fallback: "light",
              codec: {
                encode: (theme: string) => theme,
                decode: (raw: unknown) => {
                  if (typeof raw !== "string") {
                    throw new Error("Expected a string");
                  }
                  return raw;
                },
              },
            }),
          },
        },
      },
    });
    const theme = silo.value("theme");
    const events: SiloDiagnosticEvent[] = [];
    record(silo, events);
    const before = silo.diagnostics.get();

    mock.store.set("silo:theme", 42);
    mock.emit(key === null ? { key } : { key, value: 42 });

    expect(theme.get()).toBe("light");
    expect(silo.diagnostics.get()).toBe(before);
    expect(events[0]).toMatchObject({
      type: "outside dropped",
      context: { cause: expect.any(Error) },
    });

    mock.store.set("silo:theme", "dark");
    mock.emit(key === null ? { key } : { key, value: "dark" });

    expect(theme.get()).toBe("dark");
    expect(types(events)).toEqual(["outside dropped", "outside applied"]);
    expect(events[1]).toMatchObject({
      type: "outside applied",
      context: { outcome: "value" },
    });
    expect(silo.diagnostics.get().records[0]?.writes).toEqual({
      accepted: 1,
      durable: 1,
      inflight: false,
    });
    silo.dispose();
  },
);

test("a rejected diagnostics listener is reported without interrupting other listeners", async () => {
  const mock = createMockAdapter();
  const silo = new Silo({
    storages: { default: { adapters: [mock.adapter], schema } },
  });
  const theme = silo.value("theme");
  const errors: Array<() => void> = [];
  vi.spyOn(globalThis, "queueMicrotask").mockImplementation((callback) => {
    errors.push(callback);
  });
  const failure = new Error("diagnostics listener rejected");
  const events: SiloDiagnosticEvent[] = [];
  const stop = silo.diagnostics.events.subscribe(() => Promise.reject(failure));
  record(silo, events);

  mock.emit({ key: "silo:theme", value: "dark" });
  await Promise.resolve();

  expect(theme.get()).toBe("dark");
  expect(types(events)).toEqual(["outside applied"]);
  expect(errors).toHaveLength(1);
  expect(errors[0]).toThrow(failure);
  stop();
  silo.dispose();
});

test("disposal releases the registry and closes diagnostics after one final notification", async () => {
  const mock = createMockAdapter();
  const silo = new Silo({
    storages: { default: { adapters: [mock.adapter], schema } },
  });
  const theme = silo.scope("account").value("theme");
  theme.set("dark");
  const before = silo.diagnostics.get();
  const snapshots: number[] = [];
  const events: SiloDiagnosticEvent[] = [];
  silo.diagnostics.subscribe(() => {
    snapshots.push(silo.diagnostics.get().records.length);
    if (snapshots.length === 1) {
      silo.dispose();
    }
  });
  record(silo, events);

  silo.dispose();
  silo.dispose();
  await Promise.resolve();

  expect(before.records).toHaveLength(1);
  expect(silo.diagnostics.get().records).toEqual([]);
  expect(silo.diagnostics.get()).toBe(silo.diagnostics.get());
  expect(snapshots).toEqual([0]);
  expect(types(events)).toEqual(["store disposed"]);
  expect(theme.get()).toBe("dark");
  theme.set("light");
  theme.remove();
  expect(theme.get()).toBe("dark");
  const notified = vi.fn();
  silo.diagnostics.subscribe(notified);
  silo.diagnostics.events.subscribe(notified);
  silo.dispose();
  await Promise.resolve();
  expect(notified).not.toHaveBeenCalled();
});

test("diagnostics closes even when an adapter throws during disposal", () => {
  const mock = createMockAdapter();
  const silo = new Silo({
    storages: {
      default: {
        adapters: [
          {
            ...mock.adapter,
            dispose: () => {
              throw new Error("cleanup failed");
            },
          },
        ],
        schema,
      },
    },
  });
  silo.value("theme");
  const events: SiloDiagnosticEvent[] = [];
  record(silo, events);
  expect(() => silo.dispose()).toThrow("cleanup failed");
  expect(silo.diagnostics.get().records).toEqual([]);
  expect(types(events)).toEqual(["store disposed"]);
  expect(() => silo.dispose()).not.toThrow();
  expect(types(events)).toEqual(["store disposed"]);
});

test("diagnostics shares unchanged summaries and reads the committed value inside notifications", () => {
  const mock = createMockAdapter();
  const silo = new Silo({
    storages: { default: { adapters: [mock.adapter], schema } },
  });
  const theme = silo.value("theme");
  silo.scope("other").value("theme");
  const before = silo.diagnostics.get();
  const seen: unknown[] = [];
  theme.subscribe(() => seen.push(silo.diagnostics.get().records[0]?.value));
  theme.set("dark");
  const after = silo.diagnostics.get();
  expect(seen).toEqual(["dark"]);
  expect(after.records[0]).not.toBe(before.records[0]);
  expect(after.records[1]).toBe(before.records[1]);
  expect(before.records[0]?.value).toBe("light");
  expect(after.records[0]?.value).toBe("dark");
  silo.dispose();
});

test("event observation can stop and resume independently of snapshot observation", async () => {
  const mock = createMockAdapter();
  const silo = new Silo({
    storages: { default: { adapters: [mock.adapter], schema } },
  });
  const theme = silo.value("theme");
  const snapshots = vi.fn();
  silo.diagnostics.subscribe(snapshots);
  theme.set("first");
  await macrotask();
  expect(snapshots).toHaveBeenCalledOnce();
  expect(silo.diagnostics.get().records[0]?.value).toBe("first");

  const first: SiloDiagnosticEvent[] = [];
  const stop = record(silo, first);
  theme.set("second");
  stop();
  theme.set("third");
  const second: SiloDiagnosticEvent[] = [];
  record(silo, second);
  theme.set("fourth");

  expect(types(first)).toEqual(["write accepted", "write durable"]);
  expect(first[1]?.context).toEqual({ generation: 2 });
  expect(types(second)).toEqual(["write accepted", "write durable"]);
  expect(second[1]?.context).toEqual({ generation: 4 });
  expect(silo.diagnostics.get().records[0]?.writes).toEqual({
    accepted: 4,
    durable: 4,
    inflight: false,
  });
  silo.dispose();
  expect(types(second)).toEqual([
    "write accepted",
    "write durable",
    "store disposed",
  ]);
});

test("replacing an event listener during a write preserves event order", () => {
  const mock = createMockAdapter();
  const silo = new Silo({
    storages: { default: { adapters: [mock.adapter], schema } },
  });
  const theme = silo.value("theme");
  const first: SiloDiagnosticEvent[] = [];
  const second: SiloDiagnosticEvent[] = [];
  const stop = silo.diagnostics.events.subscribe((event) => {
    first.push(event);
    stop();
    record(silo, second);
  });
  theme.set("dark");

  expect(types(first)).toEqual(["write accepted"]);
  expect(types(second)).toEqual(["write durable"]);
  expect(second[0]).toMatchObject({
    source: "value",
    storage: "default",
    key: "silo:theme",
    context: { generation: 1 },
  });
  silo.dispose();
});
