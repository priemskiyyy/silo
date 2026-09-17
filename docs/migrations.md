---
description: "Silo migrations: versioned steps that move stored data forward before any value hydrates, copy, move and rename across storages, checkpoints and failures."
---

# Migrations

A schema changes faster than the data already on a user's disk. `migrations`
move that data forward before any value hydrates.

```ts
import { Silo, value } from "@priemskiyyy/silo";
import { localStorage } from "@priemskiyyy/silo-local-storage";
import { memory } from "@priemskiyyy/silo-memory";

export const silo = new Silo({
  storages: {
    default: {
      adapters: [localStorage(), memory()],
      schema: { theme: value<"light" | "dark">({ fallback: "light" }) },
    },
  },
  migrations: {
    2: (store) => {
      const legacy = store.get("legacyTheme");

      if (typeof legacy !== "string") {
        return;
      }

      store.set("theme", legacy === "night" ? "dark" : "light");
      store.remove("legacyTheme");
    },
  },
});
```

A migration is keyed by the version it migrates TO. The key `2` is the step that
takes the store from version 1 to version 2, and the highest key declared is the
version the store runs at. Keys must be positive integers; invalid versions are refused at construction.

## The lifecycle

1. Read the stored version from `${namespace}::version` in the default
   storage. An absent key, or a raw value that is not a number, reads as `0`.
2. Collect every declared step whose key is greater than the stored version,
   in ascending order. A gap in the numbering is fine; a step at or below the
   stored version is not rerun.
3. Run them one at a time, each waiting for the one before it.
4. **Record each version as its step lands.** A later failure leaves the record
   at the last step that succeeded, so that step is skipped on the next start after its checkpoint was saved.
5. Open the gate: every value's hydration and every write waits on it.

The metadata key is `${namespace}::version`. The empty middle segment cannot
collide with a value: schema keys may not contain `:` and scope segments may not
be empty. Stores with different namespaces keep separate versions on the same
medium.

## Synchronous and asynchronous storages run them differently

When **every storage is synchronous**, migrations run inside the constructor, in
the calling frame. That is what preserves the guarantee the mode exists for: the
first `get()` on a synchronous store already returns migrated data.

When **any storage is asynchronous**, they run as a promise chain. `silo.status`
reports `{ state: "migrating" }`, `silo.ready()` resolves when they finish, and
every value's hydration and every write waits on the same gate:

```ts
import { Silo, value } from "@priemskiyyy/silo";
import { indexedDb } from "@priemskiyyy/silo-indexeddb";
import { memory } from "@priemskiyyy/silo-memory";

const silo = new Silo({
  storages: {
    default: {
      adapters: [indexedDb({ name: "acme" }), memory()],
      schema: { theme: value<"light" | "dark">({ fallback: "light" }) },
    },
  },
  migrations: {
    2: async (store) => {
      const legacy = await store.get("legacyTheme");

      if (typeof legacy !== "string") {
        return;
      }

      await store.set("theme", legacy === "night" ? "dark" : "light");
      await store.remove("legacyTheme");
    },
  },
});

export const start = async () => {
  await silo.ready();

  return silo.value("theme").get();
};
```

Reaching a value before `ready()` creates its cached record, but no adapter
read is issued until admission opens.

### The synchronous fast path

A store with a synchronous default storage beside an asynchronous one, such as
`localStorage` next to IndexedDB, does not lose its first frame. The version
record lives in the default storage, so the constructor reads it in the calling
frame. If no declared step is above it, the gate opens at once, and every
synchronous storage hands out persisted values on the first `get()`. Only when a
step is pending does the chain run asynchronously behind the gate. The [Fieldbook
example](examples.md) relies on this: its theme is read from `localStorage`
before React renders, on a warm start, while its entries live in IndexedDB.

## The migration store

A migration receives a raw store over the namespace, so it can reach keys the
current schema no longer declares. Its flavour follows the storages:

```ts
type SyncMigrationStore = {
  get(key: string): unknown;
  set(key: string, value: unknown): void;
  remove(key: string): void;
  keys(): string[];
  storage(name: string): SyncMigrationStore;
  copy(key: string, target?: { to?: string; as?: string }): void;
  move(key: string, target?: { to?: string; as?: string }): void;
  rename(from: string, to: string): void;
};

type SyncMigration = (store: SyncMigrationStore) => void;
type AsyncMigration = (store: AsyncMigrationStore) => void | Promise<void>;
```

`AsyncMigrationStore` has the same members with every operation returning a
promise; `storage(name)` itself stays synchronous. `MigrationFor<typeof
storages>` names the flavour a set of storages takes, for a step declared in
another file.

| Member                  | What it does                                                                                                              |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `get`, `set`, `remove`  | The adapter's own operations on the default storage, keys namespace relative.                                             |
| `keys()`                | Every key in this storage's namespace, prefix stripped, without the version record. Throws on an adapter without `keys`.  |
| `storage(name)`         | The same access to another storage. Throws on a name the store does not declare.                                          |
| `copy(key, { to, as })` | Copies a key into a storage (`to`, default this one) under a name (`as`, default the same). An absent key copies nothing. |
| `move(key, { to, as })` | `copy`, then removes the source, unless the target is the source itself.                                                  |
| `rename(from, to)`      | `move` within this storage.                                                                                               |

The target of `copy` and `move` is composed with the **target storage's**
namespace, so moving a key from `localStorage` into a storage whose namespace is
`""` writes it bare, which is how a value crosses into the URL:

```ts
migrations: {
  2: (store) => {
    store.rename("legacyTheme", "theme");
    store.move("filter", { to: "url" });
    store.storage("secure").remove("legacyToken");
  },
},
```

The storages determine the operations available to a migration. An
all-synchronous store supplies immediate results; an asynchronous migration
store supplies promises. TypeScript's `void` return rule still permits an
inline `async` callback, as explained below:

```ts
import type { AsyncMigration } from "@priemskiyyy/silo";

const migrate: AsyncMigration = async (store) => {
  await store.remove("legacyTheme");
};

// @ts-expect-error an asynchronous migration needs an asynchronous storage.
export const silo = new Silo({
  storages: { default: { adapters: [memory()], schema } },
  migrations: { 2: migrate },
});
```

::: warning An inline `async` step is not a compile error
TypeScript accepts a function returning a promise wherever a `void` return is
expected, so writing `2: async (store) => { ... }` inline against synchronous
storages passes the typechecker. The runtime is the backstop, and it reports a
named failure on `silo.status`:

```
Silo cannot await migration 2 on the synchronous memory adapter: a step that
returns a promise needs an asynchronous adapter.
```

The type split is what stops a migration from receiving a store whose `get` is
sometimes a promise; it is not a total barrier against an `async` keyword.
:::

## Keys inside a migration

Keys are namespace relative and deliberately unvalidated. The store composes
`${namespace}:${key}`, with no scope segments of its own, so a scoped value is
reached by spelling its segments into the key, and `keys()` is how a step finds
the scopes it does not know the names of:

```ts
import type { SyncMigration } from "@priemskiyyy/silo";

// Every user's theme, at silo.scope(`users:${id}`).value("theme"), whose
// physical key is `silo:users:${id}:theme`.
export const migrate: SyncMigration = (store) => {
  for (const key of store.keys()) {
    if (!key.endsWith(":legacyTheme")) {
      continue;
    }

    store.rename(key, key.replace(/:legacyTheme$/, ":theme"));
  }
};
```

Values pass through undecoded, exactly as the adapter holds them: no codec runs,
no expiry envelope is added or removed, and a key that declares `expires` is
seen as its `{ value, expires: { at } }` envelope. Migrating a value is raw work,
which is why the store is typed `unknown` and every branch has to narrow.

`keys()` needs an adapter that enumerates. Most shipped adapters do; the Expo
secure store cannot list what it holds, and `http` drops `keys` when its server
has no key list. A step that calls `keys()` on an adapter without it fails the
migration with a named error rather than guessing.

## Failure semantics

A step that throws, or a promise that rejects, stops the chain:

- `silo.status` becomes `{ state: "error", error: { phase: "migrate", cause } }`
  and `silo.ready()` rejects with the same cause.
- The gate stays CLOSED on purpose. Every value reads its fallback with
  `{ state: "error", error: { phase: "hydrate", cause } }`, and every write is
  refused with `{ phase: "write" }` rather than reaching the adapter. Writing
  schema-shaped values over data that is still a version behind is worse than
  refusing to write.
- The stored version stays at the last step that landed, so the next start
  resumes at the step that failed.

Synchronous storages report the failure the same way rather than throwing out
of the constructor, because a store is usually constructed at module scope and
the application should still load, on fallbacks, with the error where the
[devtools](devtools.md) can show it.

Recovery is a reload after fixing the migration. There is no retry API, and
there is no partial-progress record to repair beyond the version itself.

## Testing a migration

Plant the old shape and the old version on a memory adapter, construct, and
read:

```ts
import { Silo, value } from "@priemskiyyy/silo";
import { memory } from "@priemskiyyy/silo-memory";
import { expect, test } from "vitest";

test("version 2 renames the theme", () => {
  const adapter = memory();
  adapter.native.set("silo::version", 1);
  adapter.native.set("silo:legacyTheme", "dark");

  const silo = new Silo({
    storages: {
      default: {
        adapters: [adapter],
        schema: { theme: value<"light" | "dark">({ fallback: "light" }) },
      },
    },
    migrations: { 2: (store) => store.rename("legacyTheme", "theme") },
  });

  expect(silo.status.get()).toEqual({ state: "ready" });
  expect(silo.value("theme").get()).toBe("dark");
  expect(adapter.native.get("silo::version")).toBe(2);
  silo.dispose();
});
```

The Fieldbook example's "Plant v1 data" does the same in the browser, and
[application testing](testing.md) covers the mock adapter for a step that must
fail.

## The concurrency ceiling, named

**Concurrent initialization across tabs is not locked.** Two tabs opening cold at
the same time can both read the stored version, both find it behind, and both run
the same migration. A step that is idempotent survives this; one that appends, or
that increments, does not.

Write steps that tolerate running twice: read the current data and update it
only when it has the old shape. Applications that require cross-tab locking
need to coordinate initialization separately.
`copy`, `move` and `rename` already tolerate an absent source.

## Related

- [Errors and recovery](errors-and-recovery.md) for what each failure phase means.
- [Hydration and flush](hydration-and-flush.md) for the gate every value waits on.
- [Storages and namespaces](storages.md) for how a physical key is composed per storage.
