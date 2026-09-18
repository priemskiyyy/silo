import { expect, test, vi } from "vitest";
import type { Codec } from "src/types/Codec";
import type { MockNative } from "src/mock/createMockAdapter";
import { createMockAdapter } from "src/mock/createMockAdapter";
import { Silo } from "src/utils/Silo";
import { createStorageAdapter } from "src/generators/createStorageAdapter";
import { value } from "src/utils/value";

type Theme = "light" | "dark";

const boxes = {
  encode: (boxed: { count: number }) => boxed.count,
  // Allocates on every call, so a decode per read would break identity.
  decode: (raw: unknown) => ({ count: Number(raw) }),
} satisfies Codec<{ count: number }>;

const strings = {
  encode: (text: string) => text,
  decode: (raw: unknown) => {
    if (typeof raw !== "string") {
      throw new Error(`Expected a string, received ${typeof raw}.`);
    }

    return raw;
  },
} satisfies Codec<string>;

const Schema = {
  theme: value<Theme>({ fallback: "light" }),
  visits: value({ fallback: 0 }),
  boxed: value({ codec: boxes }),
  strict: value({ codec: strings }),
  token: value({ codec: strings, expires: { in: 1_000 } }),
};

const callsTo = (
  mock: MockNative,
  operation: "get" | "set" | "remove",
  key: string,
) =>
  mock.calls.filter((call) => call.operation === operation && call.key === key);

// Settles everything the mock holds and keeps going while settling one write
// starts the next: the pipeline only ever has a single write in flight, so the
// round ends when nothing settled and no new call appeared.
const drain = async (mock: MockNative): Promise<void> => {
  const seen = mock.calls.length;
  mock.calls.filter((call) => call.pending).forEach((call) => call.settle());
  // A macrotask, so every microtask a settlement fans out into has run before
  // the round is judged, however deep the chain behind it is.
  await new Promise((resolve) => setTimeout(resolve, 0));

  if (mock.calls.length === seen && mock.calls.every((call) => !call.pending)) {
    return;
  }

  return drain(mock);
};

// Both modes, each with its own adapter type: a union would be assignable to
// neither constructor overload.
const createSilo = (mode: "sync" | "async") => {
  if (mode === "async") {
    const mock = createMockAdapter({ mode: "async" });
    return {
      mock,
      silo: new Silo({
        storages: { default: { adapters: [mock.adapter], schema: Schema } },
      }),
    };
  }

  const mock = createMockAdapter();
  return {
    mock,
    silo: new Silo({
      storages: { default: { adapters: [mock.adapter], schema: Schema } },
    }),
  };
};

test("a synchronous adapter without migrations hydrates inside value() and never reports hydrating", () => {
  const mock = createMockAdapter();
  mock.store.set("silo:theme", "dark");
  const silo = new Silo({
    storages: { default: { adapters: [mock.adapter], schema: Schema } },
  });

  const theme = silo.value("theme");

  // Not one await in this test: the first get already returns persisted data.
  expect(theme.get()).toBe("dark");
  expect(theme.status.get()).toEqual({ state: "ready" });
  silo.dispose();
});

test("get returns the stored reference, so decoding runs once per inbound value", () => {
  const mock = createMockAdapter();
  mock.store.set("silo:boxed", 7);
  const silo = new Silo({
    storages: { default: { adapters: [mock.adapter], schema: Schema } },
  });
  const boxed = silo.value("boxed");

  const first = boxed.get();

  expect(boxed.get()).toBe(first);
  expect(first).toEqual({ count: 7 });

  const next = { count: 8 };
  boxed.set(next);

  expect(boxed.get()).toBe(next);
  expect(boxed.get()).toBe(next);
  silo.dispose();
});

test("an unchanged status does not notify, because the payload free statuses are interned", () => {
  const { mock, silo } = createSilo("sync");
  const visits = silo.value("visits");
  const observed = vi.fn();
  const stop = visits.status.subscribe(observed);

  visits.set(1);
  visits.set(2);

  expect(observed).not.toHaveBeenCalled();
  expect(mock.store.get("silo:visits")).toBe(2);
  stop();
  silo.dispose();
});

test("two acquisitions of the same key share one handle and produce exactly one read", async () => {
  const mock = createMockAdapter({ mode: "async", hold: true });
  const silo = new Silo({
    storages: { default: { adapters: [mock.adapter], schema: Schema } },
  });

  const first = silo.value("theme");
  const second = silo.value("theme");
  first.get();
  const stop = second.subscribe(() => {});
  const hydrated = second.hydrated();

  expect(second).toBe(first);
  expect(callsTo(mock, "get", "silo:theme")).toHaveLength(1);
  await drain(mock);
  await hydrated;

  expect(first.get()).toBe("light");
  stop();
  silo.dispose();
});

test("a read a write overtook cannot land on top of it, on an asynchronous adapter", async () => {
  const mock = createMockAdapter({ mode: "async", hold: true });
  mock.store.set("silo:theme", "light");
  const silo = new Silo({
    storages: { default: { adapters: [mock.adapter], schema: Schema } },
  });
  const theme = silo.value("theme");
  const read = callsTo(mock, "get", "silo:theme")[0];

  theme.set("dark");
  callsTo(mock, "set", "silo:theme")[0]?.settle();
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  // The read comes back to a record with nothing in flight, carrying what disk
  // held before the write: only its reservation says it is stale.
  mock.store.set("silo:theme", "what the read already saw");
  read?.settle();
  await drain(mock);

  expect(theme.get()).toBe("dark");
  expect(theme.status.get()).toEqual({ state: "ready" });
  silo.dispose();
});

test("a read a write overtook cannot land on top of it, on a synchronous adapter", () => {
  let overtake = () => {};
  const mock = createMockAdapter({
    onCall: (call) => {
      if (call.operation !== "get") {
        return;
      }

      if (call.key !== "silo:theme") {
        return;
      }

      overtake();
    },
  });
  mock.store.set("silo:theme", "light");
  const silo = new Silo({
    storages: { default: { adapters: [mock.adapter], schema: Schema } },
  });
  const theme = silo.value("theme");
  // The adapter writes back from inside the next read and leaves that read a
  // version behind, which is the only way a synchronous read is still open when
  // a mutation arrives.
  overtake = () => {
    theme.set("dark");
    mock.store.set("silo:theme", "what the read already saw");
  };

  mock.emit({ key: null });

  expect(theme.get()).toBe("dark");
  expect(theme.status.get()).toEqual({ state: "ready" });
  silo.dispose();
});

test("a set that lands mid read wins and settles hydrated() without waiting for the read", async () => {
  const mock = createMockAdapter({ mode: "async", hold: true });
  mock.store.set("silo:theme", "light");
  const silo = new Silo({
    storages: { default: { adapters: [mock.adapter], schema: Schema } },
  });
  const theme = silo.value("theme");
  const hydrated = theme.hydrated();

  theme.set("dark");
  await hydrated;

  // The discarded read is still open: hydration settled on the write instead.
  expect(callsTo(mock, "get", "silo:theme")[0]?.pending).toBe(true);
  expect(theme.get()).toBe("dark");
  expect(theme.status.get()).toEqual({ state: "ready" });
  await drain(mock);

  expect(theme.get()).toBe("dark");
  silo.dispose();
});

test("a remove that lands mid read wins", async () => {
  const mock = createMockAdapter({ mode: "async", hold: true });
  mock.store.set("silo:theme", "dark");
  const silo = new Silo({
    storages: { default: { adapters: [mock.adapter], schema: Schema } },
  });
  const theme = silo.value("theme");
  const hydrated = theme.hydrated();

  theme.remove();
  await hydrated;

  expect(theme.get()).toBe("light");
  await drain(mock);

  expect(theme.get()).toBe("light");
  expect(mock.store.has("silo:theme")).toBe(false);
  silo.dispose();
});

test("set(A) then set(B) reach the adapter in order and converge on B", async () => {
  const mock = createMockAdapter({ mode: "async", hold: true });
  const silo = new Silo({
    storages: { default: { adapters: [mock.adapter], schema: Schema } },
  });
  const visits = silo.value("visits");

  visits.set(1);
  visits.set(2);

  // One write in flight: B waits in the pending slot rather than racing A.
  expect(callsTo(mock, "set", "silo:visits")).toHaveLength(1);
  await drain(mock);

  expect(callsTo(mock, "set", "silo:visits").map((call) => call.value)).toEqual(
    [1, 2],
  );
  expect(mock.store.get("silo:visits")).toBe(2);
  silo.dispose();
});

test.each(["sync", "async"])(
  "a reentrant set inside a notification persists after the write that triggered it (%s)",
  async (mode) => {
    const { mock, silo } = createSilo(mode === "async" ? "async" : "sync");
    const visits = silo.value("visits");
    const stop = visits.subscribe(() => {
      if (visits.get() !== 1) {
        return;
      }

      visits.set(2);
    });

    visits.set(1);
    await drain(mock);
    await silo.flush();

    expect(
      callsTo(mock, "set", "silo:visits").map((call) => call.value),
    ).toEqual([1, 2]);
    expect(mock.store.get("silo:visits")).toBe(2);
    expect(visits.get()).toBe(2);
    stop();
    silo.dispose();
  },
);

test("rapid writes coalesce and a flush waiting on one that was coalesced away still resolves", async () => {
  const mock = createMockAdapter({ mode: "async", hold: true });
  const silo = new Silo({
    storages: { default: { adapters: [mock.adapter], schema: Schema } },
  });
  const visits = silo.value("visits");
  const settled = vi.fn();

  visits.set(1);
  visits.set(2);
  const barrier = visits.flush();
  barrier.then(settled, settled);
  // 2 never reaches the adapter: the pending slot is latest wins.
  visits.set(3);
  callsTo(mock, "set", "silo:visits")[0]?.settle();
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();

  expect(settled).not.toHaveBeenCalled();
  await drain(mock);
  await barrier;

  // The write that superseded it is what satisfied the barrier, rather than
  // leaving it waiting for a generation that will never land.
  expect(callsTo(mock, "set", "silo:visits").map((call) => call.value)).toEqual(
    [1, 3],
  );
  expect(mock.store.get("silo:visits")).toBe(3);
  silo.dispose();
});

test("flush rejects on a failed write and keeps rejecting until a newer mutation is accepted", async () => {
  const mock = createMockAdapter({ mode: "async", hold: true });
  const silo = new Silo({
    storages: { default: { adapters: [mock.adapter], schema: Schema } },
  });
  const visits = silo.value("visits");

  visits.set(1);
  const waiting = visits.flush();
  callsTo(mock, "set", "silo:visits")[0]?.fail(new Error("quota exceeded"));

  await expect(waiting).rejects.toThrow("quota exceeded");
  await expect(visits.flush()).rejects.toThrow("quota exceeded");
  await expect(silo.flush()).rejects.toThrow("quota exceeded");

  visits.set(2);
  await drain(mock);

  await expect(visits.flush()).resolves.toBeUndefined();
  expect(mock.store.get("silo:visits")).toBe(2);
  silo.dispose();
});

test("a failed write keeps the snapshot it reported and puts the failure in the write phase", async () => {
  const mock = createMockAdapter({ mode: "async", hold: true });
  const silo = new Silo({
    storages: { default: { adapters: [mock.adapter], schema: Schema } },
  });
  const visits = silo.value("visits");
  const observed = vi.fn();
  const stop = visits.subscribe(observed);

  visits.set(9);
  const barrier = visits.flush();
  callsTo(mock, "set", "silo:visits")[0]?.fail(new Error("quota exceeded"));

  await expect(barrier).rejects.toThrow("quota exceeded");
  // The value the caller set stays readable: rolling it back would lose it.
  expect(visits.get()).toBe(9);
  expect(visits.status.get()).toEqual({
    state: "error",
    error: { phase: "write", cause: expect.any(Error) },
  });
  expect(observed).toHaveBeenCalledTimes(1);
  stop();
  silo.dispose();
});

test("a decode failure keeps the corrupt raw exactly where it is and resolves hydrated()", async () => {
  const mock = createMockAdapter();
  mock.store.set("silo:strict", 42);
  const silo = new Silo({
    storages: { default: { adapters: [mock.adapter], schema: Schema } },
  });
  const strict = silo.value("strict");

  expect(strict.get()).toBeUndefined();
  expect(strict.status.get()).toEqual({
    state: "error",
    error: { phase: "hydrate", cause: expect.any(Error) },
  });
  // Never deleted, never rewritten: a codec change is far likelier than a
  // corrupt disk, and both would be unrecoverable.
  expect(mock.store.get("silo:strict")).toBe(42);
  expect(callsTo(mock, "set", "silo:strict")).toEqual([]);
  expect(callsTo(mock, "remove", "silo:strict")).toEqual([]);
  await expect(strict.hydrated()).resolves.toBeUndefined();
  silo.dispose();
});

test("an adapter that throws on read takes the same path as a decode failure", () => {
  const mock = createMockAdapter({
    onCall: (call) => {
      if (call.operation !== "get") {
        return;
      }

      throw new Error("site data is blocked");
    },
  });
  const silo = new Silo({
    storages: { default: { adapters: [mock.adapter], schema: Schema } },
  });

  const theme = silo.value("theme");

  expect(theme.get()).toBe("light");
  expect(theme.status.get()).toEqual({
    state: "error",
    error: { phase: "hydrate", cause: expect.any(Error) },
  });
  silo.dispose();
});

test("a set after a decode failure clears the error and overwrites the corrupt raw", async () => {
  const mock = createMockAdapter();
  mock.store.set("silo:strict", 42);
  const silo = new Silo({
    storages: { default: { adapters: [mock.adapter], schema: Schema } },
  });
  const strict = silo.value("strict");

  strict.set("recovered");

  expect(strict.status.get()).toEqual({ state: "ready" });
  expect(strict.get()).toBe("recovered");
  expect(mock.store.get("silo:strict")).toBe("recovered");
  await expect(strict.flush()).resolves.toBeUndefined();
  silo.dispose();
});

test("an external change during a pending write is dropped, so the local write wins", async () => {
  const mock = createMockAdapter({ mode: "async", hold: true });
  const silo = new Silo({
    storages: { default: { adapters: [mock.adapter], schema: Schema } },
  });
  const theme = silo.value("theme");

  theme.set("dark");
  mock.emit({ key: "silo:theme", value: "light" });

  expect(theme.get()).toBe("dark");
  await drain(mock);

  expect(theme.get()).toBe("dark");
  expect(mock.store.get("silo:theme")).toBe("dark");
  silo.dispose();
});

test("a re-read that lands while a write is in flight is dropped", async () => {
  const mock = createMockAdapter({ mode: "async", hold: true });
  mock.store.set("silo:theme", "light");
  const silo = new Silo({
    storages: { default: { adapters: [mock.adapter], schema: Schema } },
  });
  const theme = silo.value("theme");
  await drain(mock);

  theme.set("dark");
  // An external clear re-reads every record, and this one comes back with what
  // disk held before the write that is still in flight.
  mock.emit({ key: null });
  callsTo(mock, "get", "silo:theme")[1]?.settle();
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();

  expect(theme.get()).toBe("dark");
  await drain(mock);

  expect(theme.get()).toBe("dark");
  expect(mock.store.get("silo:theme")).toBe("dark");
  silo.dispose();
});

test("a committed external change is already durable and a flush after it has nothing to wait for", async () => {
  const mock = createMockAdapter();
  const silo = new Silo({
    storages: { default: { adapters: [mock.adapter], schema: Schema } },
  });
  const theme = silo.value("theme");
  const observed = vi.fn();
  const stop = theme.subscribe(observed);

  mock.emit({ key: "silo:theme", value: "dark" });

  expect(theme.get()).toBe("dark");
  expect(observed).toHaveBeenCalledTimes(1);
  await expect(theme.flush()).resolves.toBeUndefined();
  stop();
  silo.dispose();
});

test("an external payload that will not decode leaves the previous good snapshot", () => {
  const mock = createMockAdapter();
  mock.store.set("silo:strict", "good");
  const silo = new Silo({
    storages: { default: { adapters: [mock.adapter], schema: Schema } },
  });
  const strict = silo.value("strict");

  mock.emit({ key: "silo:strict", value: 42 });

  expect(strict.get()).toBe("good");
  expect(strict.status.get()).toMatchObject({
    state: "error",
    error: { phase: "read" },
  });
  silo.dispose();
});

test("an external clear re-reads every record", () => {
  const mock = createMockAdapter();
  const silo = new Silo({
    storages: { default: { adapters: [mock.adapter], schema: Schema } },
  });
  const theme = silo.value("theme");
  const visits = silo.value("visits");
  mock.store.set("silo:theme", "dark");
  mock.store.set("silo:visits", 4);

  mock.emit({ key: null });

  expect(theme.get()).toBe("dark");
  expect(visits.get()).toBe(4);
  silo.dispose();
});

test("a listener that unsubscribes itself, one that unsubscribes another, and two identical listeners", () => {
  const { silo } = createSilo("sync");
  const visits = silo.value("visits");
  const seen: string[] = [];
  const shared = () => seen.push("shared");
  const first = visits.subscribe(shared);
  const second = visits.subscribe(shared);
  let stopOther = () => {};
  const stopSelf = visits.subscribe(() => {
    seen.push("self");
    stopSelf();
    stopOther();
  });
  stopOther = visits.subscribe(() => seen.push("other"));

  visits.set(1);

  // Identical listeners keep independent subscriptions, and one removed during
  // the notification never runs.
  expect(seen).toEqual(["shared", "shared", "self"]);

  visits.set(2);

  expect(seen).toEqual(["shared", "shared", "self", "shared", "shared"]);
  first();
  first();

  visits.set(3);

  expect(seen).toEqual([
    "shared",
    "shared",
    "self",
    "shared",
    "shared",
    "shared",
  ]);
  second();
  silo.dispose();
});

test("dispose is idempotent, silences every channel, and rejects outstanding hydrated()", async () => {
  const mock = createMockAdapter({
    mode: "async",
    hold: true,
    emitAfterDispose: true,
  });
  mock.store.set("silo:theme", "dark");
  const silo = new Silo({
    storages: { default: { adapters: [mock.adapter], schema: Schema } },
  });
  const theme = silo.value("theme");
  const hydrated = theme.hydrated();
  const observed = vi.fn();
  const stop = theme.subscribe(observed);

  silo.dispose();
  silo.dispose();

  expect(mock.disposeCount()).toBe(1);
  await expect(hydrated).rejects.toThrow(
    'This Silo was disposed before "silo:theme" finished hydrating.',
  );

  theme.set("dark");
  theme.remove();
  mock.emit({ key: "silo:theme", value: "dark" });
  await drain(mock);

  expect(observed).not.toHaveBeenCalled();
  expect(theme.get()).toBe("light");
  expect(callsTo(mock, "set", "silo:theme")).toEqual([]);
  stop();
});

test("a write already in flight at dispose still reaches the adapter", async () => {
  const mock = createMockAdapter({ mode: "async", hold: true });
  const silo = new Silo({
    storages: { default: { adapters: [mock.adapter], schema: Schema } },
  });
  const visits = silo.value("visits");

  visits.set(7);
  silo.dispose();
  callsTo(mock, "set", "silo:visits")[0]?.settle();
  await Promise.resolve();

  expect(mock.store.get("silo:visits")).toBe(7);
});

test("an expired value reads as absent and schedules its own deletion", async () => {
  const mock = createMockAdapter();
  const clock = { now: 5_000 };
  mock.store.set("silo:token", { value: "secret", expires: { at: 4_999 } });
  const silo = new Silo({
    storages: { default: { adapters: [mock.adapter], schema: Schema } },
    now: () => clock.now,
  });

  const token = silo.value("token");

  expect(token.get()).toBeUndefined();
  expect(mock.store.has("silo:token")).toBe(false);
  expect(callsTo(mock, "remove", "silo:token")).toHaveLength(1);
  await expect(token.flush()).resolves.toBeUndefined();
  silo.dispose();
});

test("a live envelope decodes, and only a key declaring expires is enveloped at all", () => {
  const mock = createMockAdapter();
  const clock = { now: 5_000 };
  mock.store.set("silo:token", { value: "secret", expires: { at: 5_001 } });
  const silo = new Silo({
    storages: { default: { adapters: [mock.adapter], schema: Schema } },
    now: () => clock.now,
  });

  expect(silo.value("token").get()).toBe("secret");
  silo.value("token").set("next");
  silo.value("theme").set("dark");

  expect(mock.store.get("silo:token")).toEqual({
    value: "next",
    expires: { at: 6_000 },
  });
  expect(mock.store.get("silo:theme")).toBe("dark");
  silo.dispose();
});

test.each(["sync", "async"])(
  "relative expiry renews on write while an absolute deadline stays fixed (%s)",
  async (mode) => {
    const mock =
      mode === "async"
        ? createMockAdapter({ mode: "async" })
        : createMockAdapter();
    const clock = { now: 5_000 };
    const silo = new Silo({
      storages: {
        default: {
          adapters: [mock.adapter],
          schema: {
            relative: value({ codec: strings, expires: { in: 1_000 } }),
            absolute: value({
              codec: strings,
              fallback: "expired",
              expires: { at: 7_000 },
            }),
          },
        },
      },
      now: () => clock.now,
    });
    const relative = silo.value("relative");
    const absolute = silo.value("absolute");
    await Promise.all([relative.hydrated(), absolute.hydrated()]);

    relative.set("first");
    absolute.set("first");
    await silo.flush();

    expect(mock.store.get("silo:relative")).toEqual({
      value: "first",
      expires: { at: 6_000 },
    });
    expect(mock.store.get("silo:absolute")).toEqual({
      value: "first",
      expires: { at: 7_000 },
    });

    clock.now = 6_500;
    relative.set("second");
    absolute.set("second");
    await silo.flush();

    expect(mock.store.get("silo:relative")).toEqual({
      value: "second",
      expires: { at: 7_500 },
    });
    expect(mock.store.get("silo:absolute")).toEqual({
      value: "second",
      expires: { at: 7_000 },
    });

    clock.now = 7_000;
    mock.emit({ key: null });
    await drain(mock);
    await silo.flush();

    expect(relative.get()).toBe("second");
    expect(absolute.get()).toBe("expired");
    expect(mock.store.has("silo:absolute")).toBe(false);
    silo.dispose();
  },
);

test("a raw that is not an envelope is a bare, never expiring value", () => {
  const mock = createMockAdapter();
  mock.store.set("silo:token", "written before expiry existed");
  const silo = new Silo({
    storages: { default: { adapters: [mock.adapter], schema: Schema } },
    now: () => Number.MAX_SAFE_INTEGER,
  });

  expect(silo.value("token").get()).toBe("written before expiry existed");
  expect(mock.store.has("silo:token")).toBe(true);
  silo.dispose();
});

test("remove resets to the fallback rather than to undefined", () => {
  const { mock, silo } = createSilo("sync");
  const visits = silo.value("visits");

  visits.set(3);
  visits.remove();

  expect(visits.get()).toBe(0);
  expect(mock.store.has("silo:visits")).toBe(false);
  silo.dispose();
});

test("setting undefined removes the key instead of writing undefined to the adapter", () => {
  const mock = createMockAdapter();
  mock.store.set("silo:strict", "stored");
  const silo = new Silo({
    storages: { default: { adapters: [mock.adapter], schema: Schema } },
  });
  const strict = silo.value("strict");

  strict.set(undefined);

  expect(strict.get()).toBeUndefined();
  expect(mock.store.has("silo:strict")).toBe(false);
  expect(callsTo(mock, "set", "silo:strict")).toEqual([]);
  expect(callsTo(mock, "remove", "silo:strict")).toHaveLength(1);
  silo.dispose();
});

test("only a failing encode reaches the caller of set", () => {
  const mock = createMockAdapter({
    onCall: (call) => {
      if (call.operation !== "set") {
        return;
      }

      throw new Error("quota exceeded");
    },
  });
  const silo = new Silo({
    storages: {
      default: {
        adapters: [mock.adapter],
        schema: {
          strict: value({
            codec: {
              encode: (text: string) => {
                if (text === "bad") {
                  throw new Error("cannot encode");
                }

                return text;
              },
              decode: strings.decode,
            },
          }),
        },
      },
    },
  });
  const strict = silo.value("strict");

  expect(() => strict.set("bad")).toThrow("cannot encode");
  // The adapter throwing is contained; the codec throwing is the caller's own.
  expect(() => strict.set("fine")).not.toThrow();
  expect(strict.status.get()).toEqual({
    state: "error",
    error: { phase: "write", cause: expect.any(Error) },
  });
  silo.dispose();
});

// `createStorageAdapter` refuses a disposed adapter by throwing synchronously in
// BOTH modes, so an asynchronous adapter can fail before it returns its promise.
const probeAsyncAdapter = () => {
  const store = new Map<string, unknown>();

  return createStorageAdapter({
    mode: "async",
    name: "probe",
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
    dispose: () => {},
  });
};

test("an asynchronous adapter that throws instead of rejecting still cannot break set", async () => {
  const adapter = probeAsyncAdapter();
  const silo = new Silo({
    storages: { default: { adapters: [adapter], schema: Schema } },
  });
  const visits = silo.value("visits");
  await visits.hydrated();
  adapter.dispose();

  expect(() => visits.set(1)).not.toThrow();

  expect(visits.get()).toBe(1);
  await expect(visits.flush()).rejects.toThrow(
    "disposed probe storage adapter",
  );
  expect(visits.status.get()).toEqual({
    state: "error",
    error: { phase: "write", cause: expect.any(Error) },
  });
  silo.dispose();
});

test("an asynchronous adapter that throws instead of rejecting still cannot break value()", async () => {
  const adapter = probeAsyncAdapter();
  const silo = new Silo({
    storages: { default: { adapters: [adapter], schema: Schema } },
  });
  adapter.dispose();

  const visits = silo.value("visits");

  await expect(visits.hydrated()).resolves.toBeUndefined();
  expect(visits.get()).toBe(0);
  expect(visits.status.get()).toEqual({
    state: "error",
    error: { phase: "hydrate", cause: expect.any(Error) },
  });
  silo.dispose();
});
