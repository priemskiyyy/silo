import { expect, test, vi } from "vitest";
import type { SiloDiagnosticEvent } from "src/types/SiloDiagnosticEvent";
import { createMockAdapter } from "src/mock/createMockAdapter";
import { Silo } from "src/utils/Silo";
import { value } from "src/utils/value";

const Schema = { theme: value({ fallback: "light" }) };

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
      default: { adapters: [local.adapter], schema: Schema },
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
    storages: { default: { adapters: [mock.adapter], schema: Schema } },
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

test("record creation is visible from its diagnostic event even after a cached empty snapshot", () => {
  const mock = createMockAdapter();
  const silo = new Silo({
    storages: { default: { adapters: [mock.adapter], schema: Schema } },
  });
  expect(silo.diagnostics.get().records).toEqual([]);
  const seen: string[][] = [];
  silo.diagnostics.events.subscribe((event) => {
    if (event.type === "record created") {
      seen.push(silo.diagnostics.get().records.map((record) => record.path));
    }
  });

  silo.value("theme");

  expect(seen).toEqual([["theme"]]);
  silo.dispose();
});

test.each(["record created", "scope released"])(
  "mutating %s context cannot change a scope's address",
  async (type) => {
    const mock = createMockAdapter();
    const silo = new Silo({
      storages: { default: { adapters: [mock.adapter], schema: Schema } },
    });
    const scope = silo.scope("account");
    const contexts: unknown[] = [];
    silo.diagnostics.events.subscribe((event) => {
      if (event.type !== type) {
        return;
      }
      const { context } = event;
      if (
        typeof context !== "object" ||
        context === null ||
        !("segments" in context) ||
        !Array.isArray(context.segments)
      ) {
        return;
      }
      context.segments.push("changed");
      contexts.push(context);
    });

    const original = scope.value("theme");
    original.set("dark");
    expect(scope.value("theme")).toBe(original);
    await scope.release();
    const reacquired = scope.value("theme");

    expect(reacquired).not.toBe(original);
    expect(reacquired).toBe(silo.scope("account").value("theme"));
    expect(reacquired.get()).toBe("dark");
    expect([...mock.store.keys()]).toEqual(["silo:account:theme"]);
    expect(silo.diagnostics.get().records).toMatchObject([
      { segments: ["account"], physicalKey: "silo:account:theme" },
    ]);
    expect(contexts).toHaveLength(type === "record created" ? 2 : 1);
    silo.dispose();
  },
);

test.each([
  { mode: "sync", event: "write accepted" },
  { mode: "async", event: "write accepted" },
  { mode: "sync", event: "write durable" },
  { mode: "async", event: "write durable" },
  { mode: "sync", event: "write refused" },
  { mode: "async", event: "write refused" },
])("$event exposes current write counters ($mode)", async ({ mode, event }) => {
  const failure = new Error("quota");
  const onCall = (call: { operation: string }) => {
    if (event !== "write refused") {
      return;
    }
    if (call.operation !== "set") {
      return;
    }
    throw failure;
  };
  const mock =
    mode === "async"
      ? createMockAdapter({ mode, onCall })
      : createMockAdapter({ onCall });
  const silo = new Silo({
    storages: { default: { adapters: [mock.adapter], schema: Schema } },
  });
  const theme = silo.value("theme");
  await theme.hydrated();
  silo.diagnostics.get();
  const seen: unknown[] = [];
  silo.diagnostics.events.subscribe((observed) => {
    if (observed.type === event) {
      seen.push(silo.diagnostics.get().records[0]?.writes);
    }
  });

  theme.set("dark");
  silo.diagnostics.get();
  if (event === "write refused") {
    await expect(theme.flush()).rejects.toBe(failure);
  }
  if (event === "write durable") {
    await theme.flush();
  }

  expect(seen).toEqual([
    {
      accepted: 1,
      durable: event === "write durable" ? 1 : 0,
      inflight: false,
    },
  ]);
  silo.dispose();
});

test("migration events and status listeners read the version and status being announced", async () => {
  const mock = createMockAdapter({ mode: "async" });
  const silo = new Silo({
    storages: { default: { adapters: [mock.adapter], schema: Schema } },
    migrations: { 1: () => {} },
  });
  silo.diagnostics.get();
  const events: unknown[] = [];
  const statuses: unknown[] = [];
  silo.diagnostics.events.subscribe((event) => {
    const snapshot = silo.diagnostics.get();
    events.push({
      type: event.type,
      stored: snapshot.version.stored,
      status: snapshot.status.state,
    });
  });
  silo.status.subscribe(() => {
    statuses.push(silo.diagnostics.get().status.state);
  });

  await silo.ready();

  expect(events).toEqual([
    { type: "migration version", stored: 0, status: "migrating" },
    { type: "migration step", stored: 0, status: "migrating" },
    { type: "migration version", stored: 1, status: "migrating" },
    { type: "migration done", stored: 1, status: "ready" },
  ]);
  expect(statuses).toEqual(["ready"]);
  silo.dispose();
});

test("migration failure is visible in diagnostics during its status and event notifications", async () => {
  const mock = createMockAdapter({ mode: "async" });
  const failure = new Error("migration failed");
  const silo = new Silo({
    storages: { default: { adapters: [mock.adapter], schema: Schema } },
    migrations: {
      1: () => {
        silo.diagnostics.get();
        throw failure;
      },
    },
  });
  const seen: unknown[] = [];
  silo.status.subscribe(() => seen.push(silo.diagnostics.get().status));
  silo.diagnostics.events.subscribe((event) => {
    if (event.type === "migration failed") {
      seen.push(silo.diagnostics.get().status);
    }
  });

  await expect(silo.ready()).rejects.toBe(failure);

  expect(seen).toEqual([
    { state: "error", error: { phase: "migrate", cause: failure } },
    { state: "error", error: { phase: "migrate", cause: failure } },
  ]);
  silo.dispose();
});

test("changes notify once per microtask and events say what happened, in order", async () => {
  const mock = createMockAdapter();
  mock.store.set("silo:theme", "dark");
  const silo = new Silo({
    storages: { default: { adapters: [mock.adapter], schema: Schema } },
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
    storages: { default: { adapters: [mock.adapter], schema: Schema } },
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
    storages: { default: { adapters: [mock.adapter], schema: Schema } },
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
    storages: { default: { adapters: [mock.adapter], schema: Schema } },
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

test("disposal from a migration event prevents the announced step from running", async () => {
  const mock = createMockAdapter({ mode: "async" });
  const migrate = vi.fn();
  const silo = new Silo({
    storages: { default: { adapters: [mock.adapter], schema: Schema } },
    migrations: { 1: migrate },
  });
  silo.diagnostics.events.subscribe((event) => {
    if (event.type === "migration step") {
      silo.dispose();
    }
  });

  await expect(silo.ready()).rejects.toThrow("disposed");
  expect(migrate).not.toHaveBeenCalled();
  expect(mock.store.has("silo::version")).toBe(false);
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
    expect(silo.diagnostics.get()).not.toBe(before);
    expect(silo.diagnostics.get().records[0]?.status).toMatchObject({
      error: { phase: "read" },
    });
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
    storages: { default: { adapters: [mock.adapter], schema: Schema } },
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
    storages: { default: { adapters: [mock.adapter], schema: Schema } },
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
  expect(silo.diagnostics.get().storages).toEqual(before.storages);
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
        schema: Schema,
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
    storages: { default: { adapters: [mock.adapter], schema: Schema } },
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
    storages: { default: { adapters: [mock.adapter], schema: Schema } },
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
    storages: { default: { adapters: [mock.adapter], schema: Schema } },
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

test.each([
  { operation: "set", outcome: "durable" },
  { operation: "remove", outcome: "durable" },
  { operation: "set", outcome: "refused" },
  { operation: "remove", outcome: "refused" },
])(
  "flush from write acceptance waits for a $operation that is $outcome",
  async ({ operation, outcome }) => {
    const mock = createMockAdapter({ mode: "async", hold: true });
    mock.store.set("silo:theme", "stored");
    const silo = new Silo({
      storages: { default: { adapters: [mock.adapter], schema: Schema } },
    });
    const theme = silo.value("theme");
    mock.calls[0]?.settle();
    await theme.hydrated();
    const barriers: Promise<void>[] = [];
    const settled = vi.fn();
    silo.diagnostics.events.subscribe((event) => {
      if (event.type !== "write accepted") {
        return;
      }
      for (const promise of [theme.flush(), silo.flush()]) {
        barriers.push(promise);
        promise.then(settled, settled);
      }
    });

    if (operation === "set") {
      theme.set("newer");
    }
    if (operation === "remove") {
      theme.remove();
    }
    await macrotask();

    expect(barriers).toHaveLength(2);
    expect(settled).not.toHaveBeenCalled();
    const write = mock.calls.find((call) => call.operation === operation);
    expect(write?.pending).toBe(true);

    if (outcome === "durable") {
      write?.settle();
      await Promise.all(barriers);
      expect(mock.store.get("silo:theme")).toBe(
        operation === "set" ? "newer" : undefined,
      );
    }
    if (outcome === "refused") {
      const failure = new Error("quota");
      write?.fail(failure);
      await Promise.all(
        barriers.map((promise) => expect(promise).rejects.toBe(failure)),
      );
      expect(mock.store.get("silo:theme")).toBe("stored");
    }
    silo.dispose();
  },
);

test("release from write acceptance waits for persistence before detaching the scope", async () => {
  const mock = createMockAdapter({ mode: "async", hold: true });
  const silo = new Silo({
    storages: { default: { adapters: [mock.adapter], schema: Schema } },
  });
  const scope = silo.scope("account");
  const theme = scope.value("theme");
  mock.calls[0]?.settle();
  await theme.hydrated();
  const released = vi.fn();
  const releases: Promise<void>[] = [];
  silo.diagnostics.events.subscribe((event) => {
    if (event.type !== "write accepted") {
      return;
    }
    const release = scope.release();
    releases.push(release);
    release.then(released);
  });

  theme.set("newer");
  await macrotask();

  expect(releases).toHaveLength(1);
  expect(released).not.toHaveBeenCalled();
  expect(silo.diagnostics.get().records).toHaveLength(1);
  mock.calls.find((call) => call.operation === "set")?.settle();
  await Promise.all(releases);

  expect(mock.store.get("silo:account:theme")).toBe("newer");
  expect(theme.get()).toBe("newer");
  expect(silo.diagnostics.get().records).toEqual([]);
  silo.dispose();
});

test("a queue closed by migration failure reports refusal without announcing acceptance", async () => {
  const mock = createMockAdapter();
  const failure = new Error("migration failed");
  const silo = new Silo({
    storages: { default: { adapters: [mock.adapter], schema: Schema } },
    migrations: {
      1: () => {
        throw failure;
      },
    },
  });
  await expect(silo.ready()).rejects.toBe(failure);
  const theme = silo.value("theme");
  const events: SiloDiagnosticEvent[] = [];
  record(silo, events);

  theme.set("newer");

  await expect(theme.flush()).rejects.toBe(failure);
  expect(types(events)).toEqual(["write refused"]);
  expect(theme.get()).toBe("newer");
  expect(theme.status.get()).toEqual({
    state: "error",
    error: { phase: "write", cause: failure },
  });
  expect(mock.calls.some((call) => call.operation === "set")).toBe(false);
  silo.dispose();
});

test.each(["sync", "async"])(
  "a write from a diagnostics listener supersedes the interrupted write (%s)",
  async (mode) => {
    const mock =
      mode === "async" ? createMockAdapter({ mode }) : createMockAdapter();
    const silo = new Silo({
      storages: { default: { adapters: [mock.adapter], schema: Schema } },
    });
    const theme = silo.value("theme");
    await theme.hydrated();
    const stop = silo.diagnostics.events.subscribe((event) => {
      if (event.type !== "write accepted") {
        return;
      }
      stop();
      theme.set("newer");
    });

    theme.set("older");
    await theme.flush();

    expect(theme.get()).toBe("newer");
    expect(mock.store.get("silo:theme")).toBe("newer");
    silo.dispose();
  },
);

test.each([
  { mode: "sync", event: "hydrate landed" },
  { mode: "async", event: "hydrate landed" },
  { mode: "sync", event: "write accepted" },
  { mode: "async", event: "write accepted" },
])(
  "reacquiring during $event does not restart hydration ($mode)",
  async ({ mode, event }) => {
    const mock =
      mode === "async" ? createMockAdapter({ mode }) : createMockAdapter();
    mock.store.set(
      "silo:theme",
      event === "write accepted"
        ? { value: "expired", expires: { at: 500 } }
        : "stored",
    );
    const silo = new Silo({
      storages: {
        default: {
          adapters: [mock.adapter],
          schema: {
            theme: value({ fallback: "light", expires: { in: 1_000 } }),
          },
        },
      },
      now: () => 1_000,
    });
    const inspected = vi.fn();
    const stop = silo.diagnostics.events.subscribe((observed) => {
      if (observed.type !== event) {
        return;
      }
      stop();
      inspected(silo.value("theme"));
    });

    const theme = silo.value("theme");
    await theme.hydrated();
    await theme.flush();

    expect(inspected).toHaveBeenCalledExactlyOnceWith(theme);
    expect(mock.calls.filter((call) => call.operation === "get")).toHaveLength(
      1,
    );
    expect(theme.get()).toBe(event === "write accepted" ? "light" : "stored");
    expect(theme.status.get()).toEqual({ state: "ready" });
    silo.dispose();
  },
);

test("reacquiring during an external update preserves the pending hydration read", async () => {
  const mock = createMockAdapter({ mode: "async", hold: true });
  mock.store.set("silo:theme", "older");
  const silo = new Silo({
    storages: { default: { adapters: [mock.adapter], schema: Schema } },
  });
  const theme = silo.value("theme");
  const inspected = vi.fn();
  const stop = silo.diagnostics.events.subscribe((event) => {
    if (event.type !== "outside applied") {
      return;
    }
    stop();
    inspected(silo.value("theme"));
  });

  mock.emit({ key: "silo:theme", value: "newer" });
  mock.calls[0]?.settle();
  await theme.hydrated();

  expect(inspected).toHaveBeenCalledExactlyOnceWith(theme);
  expect(mock.calls).toHaveLength(1);
  expect(theme.get()).toBe("newer");
  silo.dispose();
});

test("a reload from a hydration event supersedes the result being announced", async () => {
  const mock = createMockAdapter({ mode: "async", hold: true });
  mock.store.set("silo:theme", "older");
  const silo = new Silo({
    storages: { default: { adapters: [mock.adapter], schema: Schema } },
  });
  const theme = silo.value("theme");
  const stop = silo.diagnostics.events.subscribe((event) => {
    if (event.type !== "hydrate landed") {
      return;
    }
    stop();
    mock.store.set("silo:theme", "newer");
    mock.emit({ key: null });
  });

  mock.calls[0]?.settle();
  await macrotask();

  expect(theme.get()).toBe("light");
  expect(theme.status.get()).toEqual({ state: "hydrating" });
  expect(mock.calls).toHaveLength(2);
  mock.calls[1]?.settle();
  await theme.hydrated();

  expect(theme.get()).toBe("newer");
  expect(theme.status.get()).toEqual({ state: "ready" });
  silo.dispose();
});

test.each(["silo:theme", null])(
  "a reload from an external event supersedes the incoming value (key: %s)",
  async (key) => {
    const mock = createMockAdapter({ mode: "async", hold: true });
    mock.store.set("silo:theme", "initial");
    const silo = new Silo({
      storages: { default: { adapters: [mock.adapter], schema: Schema } },
    });
    const theme = silo.value("theme");
    mock.calls[0]?.settle();
    await theme.hydrated();
    const stop = silo.diagnostics.events.subscribe((event) => {
      if (event.type !== "outside applied") {
        return;
      }
      stop();
      mock.store.set("silo:theme", "newest");
      mock.emit({ key: null });
    });

    mock.store.set("silo:theme", "older");
    mock.emit(key === null ? { key } : { key, value: "older" });
    if (key === null) {
      mock.calls[1]?.settle();
    }
    await macrotask();

    expect(theme.get()).toBe("initial");
    expect(mock.calls).toHaveLength(key === null ? 3 : 2);
    expect(mock.calls.at(-1)?.pending).toBe(true);
    mock.calls.at(-1)?.settle();
    await macrotask();

    expect(theme.get()).toBe("newest");
    expect(theme.status.get()).toEqual({ state: "ready" });
    silo.dispose();
  },
);

test.each(["hydrate landed", "outside applied"])(
  "a write from a %s listener supersedes the incoming value",
  async (type) => {
    const mock = createMockAdapter({ mode: "async", hold: true });
    mock.store.set("silo:theme", "stored");
    const silo = new Silo({
      storages: { default: { adapters: [mock.adapter], schema: Schema } },
    });
    const theme = silo.value("theme");
    silo.diagnostics.events.subscribe((event) => {
      if (event.type !== type) {
        return;
      }
      theme.set("newer");
    });

    mock.calls[0]?.settle();
    await theme.hydrated();
    if (type === "outside applied") {
      mock.emit({ key: "silo:theme", value: "outside" });
    }
    mock.calls.find((call) => call.operation === "set")?.settle();
    await theme.flush();

    expect(theme.get()).toBe("newer");
    expect(mock.store.get("silo:theme")).toBe("newer");
    silo.dispose();
  },
);
