import { expect, test, vi } from "vitest";
import type { AsyncMigration } from "src/types/AsyncMigration";
import type { MockNative } from "src/mock/createMockAdapter";
import type { SyncMigration } from "src/types/SyncMigration";
import { createMockAdapter } from "src/mock/createMockAdapter";
import { createStorageAdapter } from "src/generators/createStorageAdapter";
import { Silo } from "src/utils/Silo";
import { value } from "src/utils/value";

type Theme = "light" | "dark";

const Schema = {
  theme: value<Theme>({ fallback: "light" }),
  visits: value({ fallback: 0 }),
};

// Same shape as the value tests: settle everything the mock holds until neither
// a settlement nor a new call is left.
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

test("the namespace defaults to silo, and an empty one is the shared keyspace opt-in", () => {
  const prefixed = createMockAdapter();
  const shared = createMockAdapter();

  new Silo({
    storages: { default: { adapters: [prefixed.adapter], schema: Schema } },
  })
    .value("theme")
    .set("dark");
  new Silo({
    storages: { default: { adapters: [shared.adapter], schema: Schema } },
    namespace: "",
  })
    .value("theme")
    .set("dark");

  expect([...prefixed.store.keys()]).toEqual(["silo:theme"]);
  expect([...shared.store.keys()]).toEqual(["theme"]);
});

test("a namespace, a schema key and a scope segment are validated where each is written", () => {
  const mock = createMockAdapter();

  expect(
    () =>
      new Silo({
        storages: { default: { adapters: [mock.adapter], schema: Schema } },
        namespace: "a:b",
      }),
  ).toThrow('A Silo namespace must not contain ":", received "a:b".');
  expect(
    () =>
      new Silo({
        storages: {
          default: {
            adapters: [mock.adapter],
            schema: { "a:b": value<string>({ fallback: "x" }) },
          },
        },
      }),
  ).toThrow('A Silo schema key must not contain ":" or ".", received "a:b".');
  expect(() =>
    new Silo({
      storages: { default: { adapters: [mock.adapter], schema: Schema } },
    }).scope(""),
  ).toThrow("A Silo scope segment must not be empty.");
});

test("a key the schema does not declare is refused at the boundary", () => {
  const mock = createMockAdapter();
  const silo = new Silo({
    storages: { default: { adapters: [mock.adapter], schema: Schema } },
  });

  // @ts-expect-error the schema declares no such key, which is the type's job
  expect(() => silo.value("nope")).toThrow(
    'Silo has no value named "nope" in its storages.',
  );
  silo.dispose();
});

test("a list of adapters picks the first available at construction, keeps it, and disposes the rest", () => {
  const blocked = createMockAdapter({ available: false });
  const chosen = createMockAdapter({ available: true });
  const spare = createMockAdapter();
  const silo = new Silo({
    storages: {
      default: {
        adapters: [blocked.adapter, chosen.adapter, spare.adapter],
        schema: Schema,
      },
    },
  });

  expect(silo.native.default).toBe(chosen.adapter.native);
  expect(blocked.disposeCount()).toBe(1);
  expect(spare.disposeCount()).toBe(1);
  silo.value("theme").set("dark");

  expect(chosen.store.get("silo:theme")).toBe("dark");
  expect(blocked.store.size).toBe(0);
  silo.dispose();

  expect(chosen.disposeCount()).toBe(1);
});

test("a list with an asynchronous candidate is an asynchronous store, whichever candidate wins", async () => {
  const slow = createMockAdapter({ mode: "async", available: false });
  const chosen = createMockAdapter();
  const silo = new Silo({
    storages: {
      default: { adapters: [slow.adapter, chosen.adapter], schema: Schema },
    }, // Typed as an asynchronous migration by the list itself, before anything
    // ran: one asynchronous candidate anywhere decides the flavour.
    migrations: { 1: async (store) => await store.set("visits", 3) },
  });
  const visits = silo.value("visits");

  expect(silo.status.get()).toEqual({ state: "migrating" });
  expect(visits.status.get()).toEqual({ state: "hydrating" });
  await silo.ready();
  await visits.hydrated();

  expect(visits.get()).toBe(3);
  expect(chosen.store.get("silo:visits")).toBe(3);
  silo.dispose();
});

test("the last candidate is taken as given, so a list with nothing available still constructs", () => {
  const first = createMockAdapter({ available: false });
  const last = createMockAdapter({ available: false });
  const silo = new Silo({
    storages: {
      default: { adapters: [first.adapter, last.adapter], schema: Schema },
    },
  });

  expect(silo.native.default).toBe(last.adapter.native);
  silo.value("theme").set("dark");

  expect(last.store.get("silo:theme")).toBe("dark");
  silo.dispose();
});

test("native carries the adapter's own handle", () => {
  const mock = createMockAdapter();
  const silo = new Silo({
    storages: { default: { adapters: [mock.adapter], schema: Schema } },
  });

  expect(silo.native.default).toBe(mock.adapter.native);
  expect(silo.native.default.store).toBe(mock.store);
  silo.dispose();
});

test("an adapter without observe is used without one capability check on its name", () => {
  const mock = createMockAdapter({ observe: false });
  const silo = new Silo({
    storages: { default: { adapters: [mock.adapter], schema: Schema } },
  });

  silo.value("theme").set("dark");

  expect(mock.store.get("silo:theme")).toBe("dark");
  expect(() => silo.dispose()).not.toThrow();
});

test("scopes isolate their keys, nest, and hand back the same value per key", () => {
  const mock = createMockAdapter();
  const silo = new Silo({
    storages: { default: { adapters: [mock.adapter], schema: Schema } },
  });
  const account = silo.scope("users:7");
  const nested = account.scope("prefs");

  silo.value("visits").set(1);
  account.value("visits").set(2);
  nested.value("visits").set(3);

  expect([...mock.store]).toEqual([
    ["silo:visits", 1],
    ["silo:users:7:visits", 2],
    ["silo:users:7:prefs:visits", 3],
  ]);
  expect(silo.value("visits").get()).toBe(1);
  expect(account.value("visits").get()).toBe(2);
  // A scope handle is not memoized, but the record behind a key is.
  expect(silo.scope("users:7").value("visits")).toBe(account.value("visits"));
  silo.dispose();
});

test("clear removes every declared key at its own scope and resolves as a barrier", async () => {
  const mock = createMockAdapter({ mode: "async", hold: true });
  const silo = new Silo({
    storages: { default: { adapters: [mock.adapter], schema: Schema } },
  });
  const account = silo.scope("users:7");
  mock.store.set("silo:visits", 1);
  mock.store.set("silo:users:7:visits", 2);
  mock.store.set("silo:users:7:theme", "dark");
  mock.store.set("silo:users:7:legacy", "written by an older schema");

  const cleared = account.clear();
  const settled = vi.fn();
  cleared.then(settled, settled);
  await drain(mock);
  await cleared;

  expect(settled).toHaveBeenCalledTimes(1);
  expect([...mock.store.keys()]).toEqual([
    "silo:visits",
    "silo:users:7:legacy",
  ]);
  expect(account.value("visits").get()).toBe(0);
  silo.dispose();
});

test("migrations on a synchronous adapter run in ascending order inside the constructor, up to the highest key", () => {
  const mock = createMockAdapter();
  const order: number[] = [];
  mock.store.set("silo::version", 1);
  mock.store.set("silo:legacy", "carry me");
  const migrations = {
    3: (store) => {
      order.push(3);
      store.remove("legacy");
    },
    2: (store) => {
      order.push(2);
      store.set("theme", store.get("legacy") === "carry me" ? "dark" : "light");
    },
    4: (store) => {
      order.push(4);
      store.set("visits", 9);
    },
  } satisfies Record<number, SyncMigration>;

  const silo = new Silo({
    storages: { default: { adapters: [mock.adapter], schema: Schema } },
    migrations,
  });

  // Ascending, nothing below the stored version, and the highest key declared
  // is the version the store runs at.
  expect(order).toEqual([2, 3, 4]);
  expect(mock.store.get("silo::version")).toBe(4);
  expect(mock.store.has("silo:legacy")).toBe(false);
  expect(silo.value("theme").get()).toBe("dark");
  expect(silo.value("visits").get()).toBe(9);
  expect(silo.status.get()).toEqual({ state: "ready" });
  silo.dispose();
});

test("a migration key that is not a positive integer is refused at construction", () => {
  const mock = createMockAdapter();
  const refused = (migrations: Record<string, SyncMigration>) =>
    expect(
      // The record is typed by version number; a caller without types can
      // still hand over anything, which is what this guards.
      () =>
        new Silo({
          storages: { default: { adapters: [mock.adapter], schema: Schema } },
          migrations,
        }),
    ).toThrow("A Silo migration is keyed by the positive integer version");

  refused({ "0": () => undefined });
  refused({ "-1": () => undefined });
  refused({ "1.5": () => undefined });
  refused({ v2: () => undefined });
  refused({ "02": () => undefined });
  expect(mock.store.has("silo::version")).toBe(false);
});

test("a failed synchronous migration is reported, closes the gate, and the next start resumes at the step that failed", () => {
  const mock = createMockAdapter();
  const order: number[] = [];
  mock.store.set("silo::version", 1);
  mock.store.set("silo:theme", "dark");
  const failing = {
    2: (store) => {
      order.push(2);
      store.set("visits", 1);
    },
    3: () => {
      order.push(3);
      throw new Error("migration 3 failed");
    },
  } satisfies Record<number, SyncMigration>;

  // Reported rather than thrown out of a constructor that usually runs at
  // module scope: the application still loads, on fallbacks.
  const broken = new Silo({
    storages: { default: { adapters: [mock.adapter], schema: Schema } },
    migrations: failing,
  });
  const theme = broken.value("theme");

  expect(broken.status.get()).toEqual({
    state: "error",
    error: { phase: "migrate", cause: expect.any(Error) },
  });
  // Step 2 landed and was recorded before step 3 ran, so it never runs again.
  expect(mock.store.get("silo::version")).toBe(2);
  // Reads fall back in the calling frame, with the migration as the cause, and
  // the persisted value is never handed out in the old shape.
  expect(theme.get()).toBe("light");
  expect(theme.status.get()).toEqual({
    state: "error",
    error: { phase: "hydrate", cause: expect.any(Error) },
  });

  theme.set("light");

  // Writes are refused: schema-shaped values must not land on data that is
  // still a version behind.
  expect(mock.store.get("silo:theme")).toBe("dark");
  expect(theme.status.get()).toEqual({
    state: "error",
    error: { phase: "write", cause: expect.any(Error) },
  });

  // The next start, over the same adapter, retries from the same point.
  const silo = new Silo({
    storages: { default: { adapters: [mock.adapter], schema: Schema } },
    migrations: { ...failing, 3: () => order.push(3) },
  });

  expect(order).toEqual([2, 3, 3]);
  expect(mock.store.get("silo::version")).toBe(3);
  expect(silo.status.get()).toEqual({ state: "ready" });
  silo.dispose();
  broken.dispose();
});

test("ready rejects with the synchronous migration that failed, and resolves otherwise", async () => {
  const mock = createMockAdapter();
  const failed = new Silo({
    storages: { default: { adapters: [mock.adapter], schema: Schema } },
    migrations: {
      1: () => {
        throw new Error("migration 1 failed");
      },
    },
  });

  await expect(failed.ready()).rejects.toThrow("migration 1 failed");
  failed.dispose();

  const fine = new Silo({
    storages: {
      default: { adapters: [createMockAdapter().adapter], schema: Schema },
    },
  });

  await expect(fine.ready()).resolves.toBeUndefined();
  fine.dispose();
});

test("a synchronous migration that returns a promise is reported as a named failure", () => {
  const mock = createMockAdapter();
  const silo = new Silo({
    storages: { default: { adapters: [mock.adapter], schema: Schema } },
    migrations: { 2: () => Promise.resolve() },
  });
  const status = silo.status.get();

  expect(status.state).toBe("error");

  if (status.state !== "error") {
    throw new Error("unreachable");
  }

  expect(status.error.phase).toBe("migrate");
  expect(String(status.error.cause)).toContain(
    "Silo cannot await migration 2 on the synchronous mock adapter: a step that returns a promise needs an asynchronous adapter.",
  );
  expect(mock.store.has("silo::version")).toBe(false);
  silo.dispose();
});

test("migrations on an asynchronous adapter report migrating and defer every hydration", async () => {
  const mock = createMockAdapter({ mode: "async", hold: true });
  mock.store.set("silo:theme", "dark");
  const migrations = {
    2: async (store) => {
      await store.set("visits", 4);
    },
  } satisfies Record<number, AsyncMigration>;
  const silo = new Silo({
    storages: { default: { adapters: [mock.adapter], schema: Schema } },
    migrations,
  });
  const theme = silo.value("theme");
  const visits = silo.value("visits");

  expect(silo.status.get()).toEqual({ state: "migrating" });
  expect(theme.status.get()).toEqual({ state: "hydrating" });
  // The gate is closed, so no value has been read yet.
  expect(mock.calls.filter((call) => call.key === "silo:theme")).toEqual([]);
  // Two rounds, because the reads only start once the gate has opened.
  await drain(mock);
  await silo.ready();
  await drain(mock);

  expect(silo.status.get()).toEqual({ state: "ready" });
  expect(mock.store.get("silo::version")).toBe(2);
  expect(theme.get()).toBe("dark");
  expect(visits.get()).toBe(4);
  silo.dispose();
});

test("a failed asynchronous migration reports the failure and refuses to write over the old shape", async () => {
  const mock = createMockAdapter({ mode: "async" });
  mock.store.set("silo::version", 1);
  const silo = new Silo({
    storages: { default: { adapters: [mock.adapter], schema: Schema } },
    migrations: {
      2: () => Promise.reject(new Error("migration 2 failed")),
    },
  });
  const theme = silo.value("theme");

  await expect(silo.ready()).rejects.toThrow("migration 2 failed");
  expect(silo.status.get()).toEqual({
    state: "error",
    error: { phase: "migrate", cause: expect.any(Error) },
  });
  expect(mock.store.get("silo::version")).toBe(1);

  await expect(theme.hydrated()).resolves.toBeUndefined();
  expect(theme.get()).toBe("light");
  expect(theme.status.get()).toEqual({
    state: "error",
    error: { phase: "hydrate", cause: expect.any(Error) },
  });

  theme.set("dark");

  await expect(theme.flush()).rejects.toThrow("migration 2 failed");
  expect(mock.store.has("silo:theme")).toBe(false);
  silo.dispose();
});

test("a migration lists the namespace's keys, prefix stripped, without the version record or other namespaces", async () => {
  const sync = createMockAdapter();
  sync.store.set("silo::version", 1);
  sync.store.set("silo:theme", "dark");
  sync.store.set("silo:users:7:theme", "light");
  sync.store.set("other:theme", "not ours");
  let listed: string[] = [];
  const syncSilo = new Silo({
    storages: { default: { adapters: [sync.adapter], schema: Schema } },
    migrations: {
      2: (store) => {
        listed = store.keys();
        // The reason enumeration exists: scoped keys nobody can name up front.
        store.keys().forEach((key) => {
          if (key.endsWith(":theme")) {
            store.remove(key);
          }
        });
      },
    },
  });

  expect(listed).toEqual(["theme", "users:7:theme"]);
  expect([...sync.store.keys()]).toEqual([
    "silo::version",
    "silo:theme",
    "other:theme",
  ]);
  syncSilo.dispose();

  const async = createMockAdapter({ mode: "async" });
  async.store.set("silo:draft", "x");
  const asyncSilo = new Silo({
    storages: { default: { adapters: [async.adapter], schema: Schema } },
    migrations: {
      2: async (store) => {
        listed = await store.keys();
      },
    },
  });

  await asyncSilo.ready();

  expect(listed).toEqual(["draft"]);
  asyncSilo.dispose();
});

test("an adapter that cannot enumerate fails the migration that asks, by a named error", async () => {
  const sync = createMockAdapter({ keys: false });
  const syncSilo = new Silo({
    storages: { default: { adapters: [sync.adapter], schema: Schema } },
    migrations: { 1: (store) => store.keys().forEach(store.remove) },
  });

  await expect(syncSilo.ready()).rejects.toThrow(
    "The mock storage adapter cannot list its keys, so a migration cannot enumerate this namespace.",
  );
  syncSilo.dispose();

  const async = createMockAdapter({ mode: "async", keys: false });
  const asyncSilo = new Silo({
    storages: { default: { adapters: [async.adapter], schema: Schema } },
    migrations: {
      1: async (store) => {
        await store.keys();
      },
    },
  });

  await expect(asyncSilo.ready()).rejects.toThrow("cannot list its keys");
  asyncSilo.dispose();
});

test("a key lives in the storage that declares it, addressed bare in default and as storage.key elsewhere", () => {
  const preferences = createMockAdapter();
  const secure = createMockAdapter();
  const silo = new Silo({
    storages: {
      default: { adapters: [preferences.adapter], schema: Schema },
      secure: {
        adapters: [secure.adapter],
        schema: { token: value<string>() },
      },
    },
  });

  silo.value("theme").set("dark");
  silo.value("secure.token").set("t0k3n");
  silo.scope("users:7").value("secure.token").set("scoped");

  expect([...preferences.store.keys()]).toEqual(["silo:theme"]);
  expect([...secure.store.keys()]).toEqual([
    "silo:token",
    "silo:users:7:token",
  ]);
  expect(silo.native).toEqual({
    default: preferences.adapter.native,
    secure: secure.adapter.native,
  });
  // @ts-expect-error a key is addressed through the storage that declares it
  expect(() => silo.value("token")).toThrow(
    'Silo has no value named "token" in its storages.',
  );
  silo.dispose();

  expect(preferences.disposeCount()).toBe(1);
  expect(secure.disposeCount()).toBe(1);
});

test("the same key can live in several storages, as distinct values", () => {
  const preferences = createMockAdapter();
  const secure = createMockAdapter();
  const cache = createMockAdapter();
  const lastSync = { lastSync: value({ fallback: 0 }) };
  const silo = new Silo({
    storages: {
      default: { adapters: [preferences.adapter], schema: lastSync },
      secure: { adapters: [secure.adapter], schema: lastSync },
      cache: { adapters: [cache.adapter], schema: lastSync },
    },
  });

  silo.value("lastSync").set(1);
  silo.value("secure.lastSync").set(2);
  silo.value("cache.lastSync").set(3);

  // One physical key, three backends, three records.
  expect(preferences.store.get("silo:lastSync")).toBe(1);
  expect(secure.store.get("silo:lastSync")).toBe(2);
  expect(cache.store.get("silo:lastSync")).toBe(3);
  expect(silo.value("lastSync").get()).toBe(1);
  expect(silo.value("cache.lastSync").get()).toBe(3);
  silo.dispose();
});

test("a storage name or a key that would break the path is refused at construction", () => {
  expect(
    () =>
      new Silo({
        storages: {
          default: { adapters: [createMockAdapter().adapter], schema: Schema },
          "a.b": { adapters: [createMockAdapter().adapter], schema: {} },
        },
      }),
  ).toThrow(
    'A Silo storage name must be non-empty and must not contain ".", received "a.b".',
  );
  expect(
    () =>
      new Silo({
        storages: {
          default: {
            adapters: [createMockAdapter().adapter],
            schema: { "a.b": value({ fallback: 0 }) },
          },
        },
      }),
  ).toThrow('A Silo schema key must not contain ":" or ".", received "a.b".');
});

test("a change one storage reports reaches only the records that live there", () => {
  const preferences = createMockAdapter();
  const secure = createMockAdapter();
  const silo = new Silo({
    storages: {
      default: { adapters: [preferences.adapter], schema: Schema },
      secure: {
        adapters: [secure.adapter],
        schema: { token: value<string>() },
      },
    },
  });
  const theme = silo.value("theme");
  const token = silo.value("secure.token");
  preferences.store.set("silo:theme", "dark");
  secure.store.set("silo:token", "t0k3n");

  // A coarse report from one storage re-reads only its own records.
  preferences.emit({ key: null });

  expect(theme.get()).toBe("dark");
  expect(token.get()).toBeUndefined();

  // A keyed report from the wrong storage is ignored even when the key matches.
  preferences.emit({ key: "silo:token", value: "leaked" });

  expect(token.get()).toBeUndefined();
  secure.emit({ key: "silo:token", value: "t0k3n" });

  expect(token.get()).toBe("t0k3n");
  silo.dispose();
});

test("a migration reaches every storage through one store, and copy, move and rename tolerate absence", () => {
  const preferences = createMockAdapter();
  const secure = createMockAdapter();
  preferences.store.set("silo:legacyTheme", "dark");
  preferences.store.set("silo:token", "t0k3n");
  secure.store.set("silo:users:7:token", "scoped");
  const silo = new Silo({
    storages: {
      default: { adapters: [preferences.adapter], schema: Schema },
      secure: {
        adapters: [secure.adapter],
        schema: { token: value<string>() },
      },
    },
    migrations: {
      1: (store) => {
        store.rename("legacyTheme", "theme");
        store.move("token", { to: "secure" });
        store.storage("secure").copy("users:7:token", { as: "users:7:backup" });
        // Absent sources copy nothing, and a move onto itself keeps the key.
        store.move("missing", { to: "secure" });
        store.storage("secure").move("users:7:token", {});
      },
    },
  });

  expect([...preferences.store]).toEqual([
    ["silo:theme", "dark"],
    ["silo::version", 1],
  ]);
  expect([...secure.store]).toEqual([
    ["silo:users:7:token", "scoped"],
    ["silo:token", "t0k3n"],
    ["silo:users:7:backup", "scoped"],
  ]);
  expect(silo.value("theme").get()).toBe("dark");
  expect(silo.value("secure.token").get()).toBe("t0k3n");
  expect(silo.status.get()).toEqual({ state: "ready" });
  // A storage the store does not declare fails the migration, never the constructor.
  const broken = new Silo({
    storages: {
      default: { adapters: [createMockAdapter().adapter], schema: Schema },
    },
    migrations: { 1: (store) => store.storage("vault").remove("x") },
  });

  expect(broken.status.get()).toEqual({
    state: "error",
    error: { phase: "migrate", cause: expect.any(Error) },
  });
  broken.dispose();
  silo.dispose();
});

test("one asynchronous storage makes the migration store asynchronous on every storage", async () => {
  const preferences = createMockAdapter();
  const secure = createMockAdapter({ mode: "async" });
  preferences.store.set("silo:token", "t0k3n");
  const silo = new Silo({
    storages: {
      default: { adapters: [preferences.adapter], schema: Schema },
      secure: {
        adapters: [secure.adapter],
        schema: { token: value<string>() },
      },
    },
    migrations: {
      1: async (store) => {
        // The default storage is synchronous, and still answers behind a promise.
        expect(store.get("token")).toBeInstanceOf(Promise);
        await store.move("token", { to: "secure" });
      },
    },
  });

  expect(silo.status.get()).toEqual({ state: "migrating" });
  await silo.ready();

  expect(preferences.store.has("silo:token")).toBe(false);
  expect(secure.store.get("silo:token")).toBe("t0k3n");
  expect(preferences.store.get("silo::version")).toBe(1);
  silo.dispose();
});

test("flush covers every record the store has handed out", async () => {
  const mock = createMockAdapter({ mode: "async", hold: true });
  const silo = new Silo({
    storages: { default: { adapters: [mock.adapter], schema: Schema } },
  });
  const settled = vi.fn();

  silo.value("visits").set(1);
  silo.scope("users:7").value("visits").set(2);
  const flushed = silo.flush();
  flushed.then(settled, settled);
  await Promise.resolve();

  expect(settled).not.toHaveBeenCalled();
  await drain(mock);
  await flushed;

  expect(mock.store.get("silo:visits")).toBe(1);
  expect(mock.store.get("silo:users:7:visits")).toBe(2);
  silo.dispose();
});

test("flush covers dirty records in every storage without waiting for later writes to clean records", async () => {
  const local = createMockAdapter({ mode: "async", hold: true });
  const remote = createMockAdapter({ mode: "async", hold: true });
  const silo = new Silo({
    storages: {
      default: { adapters: [local.adapter], schema: Schema },
      remote: { adapters: [remote.adapter], schema: Schema },
    },
  });
  const theme = silo.value("theme");
  silo.value("visits").set(1);
  silo.scope("users:7").value("remote.visits").set(2);
  const settled = vi.fn();
  const flushed = silo.flush();
  flushed.then(settled);
  theme.set("dark");

  local.calls
    .find((call) => call.key === "silo:visits" && call.operation === "set")
    ?.settle();
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(settled).not.toHaveBeenCalled();

  remote.calls.find((call) => call.operation === "set")?.settle();
  await flushed;

  expect(settled).toHaveBeenCalledOnce();
  expect(local.store.get("silo:visits")).toBe(1);
  expect(remote.store.get("silo:users:7:visits")).toBe(2);
  expect(
    local.calls.find(
      (call) => call.key === "silo:theme" && call.operation === "set",
    )?.pending,
  ).toBe(true);
  silo.dispose();
});

test("a storage's own namespace overrides the store's, and a migration translates per storage", () => {
  const local = createMockAdapter();
  const url = createMockAdapter();
  local.store.set("app:note", "carry me");
  const silo = new Silo({
    namespace: "app",
    storages: {
      default: {
        adapters: [local.adapter],
        schema: { theme: value({ fallback: "light" }) },
      },
      url: {
        adapters: [url.adapter],
        schema: { note: value({ fallback: "" }) },
        namespace: "",
      },
    },
    migrations: {
      2: (store) => {
        expect(store.keys()).toEqual(["note"]);
        // Read under `app:`, written bare: the target storage's namespace applies.
        store.move("note", { to: "url" });
        expect(store.storage("url").keys()).toEqual(["note"]);
      },
    },
  });

  silo.value("theme").set("dark");

  expect(local.store.get("app:theme")).toBe("dark");
  expect(local.store.has("app:note")).toBe(false);
  expect(url.store.get("note")).toBe("carry me");
  expect(silo.value("url.note").get()).toBe("carry me");
  // The version record follows the default storage's namespace.
  expect(local.store.get("app::version")).toBe(2);
  silo.dispose();
});

test("the medium that won says whether the namespace is in its keys, unless the storage says otherwise", () => {
  const hiddenStore = new Map<string, unknown>();
  const hidden = createStorageAdapter({
    mode: "sync",
    name: "bare",
    native: hiddenStore,
    get: (key) => hiddenStore.get(key),
    set: (key, raw) => {
      hiddenStore.set(key, raw);
    },
    remove: (key) => {
      hiddenStore.delete(key);
    },
    available: () => true,
    dispose: () => {},
    keyspace: { namespace: "hidden" },
  });
  const visible = createMockAdapter();
  const silo = new Silo({
    namespace: "app",
    storages: {
      default: {
        adapters: [visible.adapter],
        schema: { theme: value({ fallback: "light" }) },
      },
      url: { adapters: [hidden], schema: { note: value({ fallback: "" }) } },
      pinned: {
        adapters: [hidden],
        schema: { note: value({ fallback: "" }) },
        namespace: "app",
      },
    },
  });

  silo.value("theme").set("dark");
  silo.value("url.note").set("bare");
  silo.value("pinned.note").set("prefixed");

  expect(visible.store.get("app:theme")).toBe("dark");
  expect(hiddenStore.get("note")).toBe("bare");
  expect(hiddenStore.get("app:note")).toBe("prefixed");
  silo.dispose();
});

test("a synchronous default storage keeps its first frame when no migration step is pending, even beside an asynchronous one", () => {
  const local = createMockAdapter();
  const database = createMockAdapter({ mode: "async" });
  local.store.set("silo::version", 2);
  local.store.set("silo:theme", "dark");
  const silo = new Silo({
    storages: {
      default: { adapters: [local.adapter], schema: Schema },
      database: {
        adapters: [database.adapter],
        schema: { loads: value({ fallback: 0 }) },
      },
    },
    migrations: { 2: async () => undefined },
  });

  // The version was read in this frame, nothing is pending, the gate is open.
  expect(silo.status.get()).toEqual({ state: "ready" });
  expect(silo.value("theme").status.get()).toEqual({ state: "ready" });
  expect(silo.value("theme").get()).toBe("dark");
  expect(silo.value("database.loads").status.get()).toEqual({
    state: "hydrating",
  });
  silo.dispose();
});

test("a pending step on a mixed set still runs asynchronously behind the gate", async () => {
  const local = createMockAdapter();
  const database = createMockAdapter({ mode: "async" });
  local.store.set("silo::version", 1);
  const silo = new Silo({
    storages: {
      default: { adapters: [local.adapter], schema: Schema },
      database: {
        adapters: [database.adapter],
        schema: { loads: value({ fallback: 0 }) },
      },
    },
    migrations: {
      2: async (store) => {
        await store.set("theme", "migrated");
      },
    },
  });

  expect(silo.status.get()).toEqual({ state: "migrating" });
  await silo.ready();
  expect(silo.value("theme").get()).toBe("migrated");
  expect(local.store.get("silo::version")).toBe(2);
  expect(
    local.calls.filter(
      (call) => call.operation === "get" && call.key === "silo::version",
    ),
  ).toHaveLength(1);
  silo.dispose();
});
