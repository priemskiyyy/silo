---
description: "The Silo store: constructor options, how adapters are chosen, value handles memoized per key, synchronous reads on every backend, barriers, demand and disposal."
---

# The store

A `Silo` owns an application's storages. Each storage has a schema of values
and an ordered list of candidate adapters, and the store hands out one typed
handle per key. It is a class, constructed once per application, and everything
else is reached through it.

```ts
import { Silo, value } from "@priemskiyyy/silo";
import { localStorage } from "@priemskiyyy/silo-local-storage";
import { memory } from "@priemskiyyy/silo-memory";

export const silo = new Silo({
  storages: {
    default: {
      adapters: [localStorage(), memory()],
      schema: {
        theme: value<"light" | "dark">({ fallback: "light" }),
        draft: value<string>(),
      },
    },
  },
});
```

| Option       | Meaning                                                                                                                                                                                |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `storages`   | The backends by name, each with its `schema`, its `adapters` and optionally its own `namespace`. `default` is required. See [Storages and namespaces](storages.md).                    |
| `namespace`  | Prefix on every physical key, `"silo"` by default. `""` opts into a shared keyspace. A storage's own `namespace` overrides it for the keys that live there.                            |
| `migrations` | Steps keyed by the version each one produces. The highest key is the version the store runs at. Synchronous or asynchronous, decided by the storages. See [Migrations](migrations.md). |
| `now`        | The clock [expiry](ttl.md) is measured against. Defaults to `Date.now`.                                                                                                                |

## What construction does

1. Chooses one adapter per storage: the first candidate whose `available()`
   passes, or the last one regardless. Candidates that lost are disposed.
2. Composes a keyspace per storage and validates the namespace, every storage
   name and every schema key. A bad one throws out of the constructor.
3. Starts migrations. On synchronous storages they finish inside the
   constructor. Otherwise `silo.status` reports `migrating` until they do, and
   every read and write waits behind them.

It reads no values and opens no connection. Values are read when something asks
for one.

## Addressing a value

Keys of the default storage are addressed bare. Keys of every other storage are
addressed as `storage.key`:

```ts
silo.value("theme"); // the `theme` key of the default storage
silo.value("secure.token"); // the `token` key of the `secure` storage
```

The same key name can be declared in several storages, and each is a distinct
value. A key must be declared: `silo.value("them")` does not compile, and at
runtime a key no storage declares throws
`Silo has no value named "them" in its storages.`

## A value handle

```ts
const theme = silo.value("theme");
```

`value(key)` does three things in one call. It creates the record for that key,
it starts hydration, and it returns a handle:

```ts
import type { ObservableValue, ValueStatus } from "@priemskiyyy/silo";

type SiloValue<TValue> = {
  get: () => TValue;
  set: (value: TValue) => void;
  remove: () => void;
  subscribe: (listener: () => void) => () => void;
  status: ObservableValue<ValueStatus>;
  hydrated: () => Promise<void>;
  flush: () => Promise<void>;
};
```

The handle is **memoized per key per scope** until its scope is released.
Calling `silo.value("theme")` in ten components returns the same object,
subscribed to one snapshot, hydrated by one read. There is nothing to pass down
and nothing to deduplicate.

Adapter write failures do not throw from `set`; encoding errors do. A refused
write keeps the optimistic snapshot and reports
`{ state: "error", error: { phase: "write" } }` on `status`. `set(undefined)`
is `remove()`. `get` returns the stored reference, decoded once when the value
arrived, so stored values are immutable: mutating what you passed to `set`
corrupts the snapshot with no notification. [Reactive values](reactive-values.md)
covers why identity is stable and what that buys.

## Reading is always synchronous

`get()` returns a value, never a promise, on every adapter including IndexedDB:

```ts
theme.get(); // "light" | "dark", right now
```

It reads a snapshot the store already holds, not the backend. What differs
between backends is only **when the persisted value lands in that snapshot**:

- On a synchronous adapter it is already there when `value(key)` returns, so
  the first `get()` is the stored value.
- On an asynchronous adapter the first `get()` is the fallback, and the stored
  value replaces it when the read resolves.

[Synchronous and asynchronous](sync-vs-async.md) is the whole story, including
why the adapter contract is split in two.

## Promises are barriers, not reads

Six calls return promises. None of them is a read.

| Barrier            | Resolves when                                                                     |
| ------------------ | --------------------------------------------------------------------------------- |
| `value.hydrated()` | The first read for that key has landed, whatever its outcome.                     |
| `value.flush()`    | Every mutation accepted before the call has reached the adapter.                  |
| `silo.flush()`     | The same, across every value the store has touched.                               |
| `silo.clear()`     | Every declared key of every storage at this scope has been removed and persisted. |
| `silo.release()`   | Every pending write at this scope is durable and its cached records are freed.    |
| `silo.ready()`     | Migrations are done. Rejects with the migration that failed.                      |

```ts
const draft = silo.value("draft");

draft.set("hello");
await draft.flush(); // now it is on the backend
```

[Hydration and flush](hydration-and-flush.md) covers what each one waits for and
how they fail.

## Demand: what starts a read

`silo.value(key)` creates a record and starts hydration. Further acquisitions
of the same storage and physical key reuse that record and its initial read.
Once you hold a handle, `get()`, `subscribe()`, `status`, `hydrated()` and
`flush()` do not issue another read.

Store-level `silo.status`, `silo.flush()` and `silo.diagnostics` do not acquire
records. A framework status hook does acquire the key to find its status,
so mounting `useValueStatus(key)` starts hydration if needed.

## The rest of the store

```ts
silo.status.get(); // { state: "migrating" | "ready" | "error", ... }
silo.native.default; // the chosen adapter's own handle, by storage name
silo.scope("users:7"); // the same storages under a prefix
silo.diagnostics.get(); // a snapshot of every storage and cached record
silo.dispose(); // stop everything
```

- [`silo.status`](migrations.md) reports the store itself: `migrating` while
  migrations run, then `ready`, or `error` when one failed.
- [`silo.native`](native-access.md) holds each storage's chosen adapter's own
  client, for example the `Storage` object or a `Map`, typed as the union of
  that storage's candidates and stable for the store's life.
- [`silo.scope(segment)`](scopes.md) returns the same storages under a key
  prefix, for per-account or per-document values.
- [`silo.clear()`](scopes.md#clear) removes every declared key at the root
  scope.
- [`silo.release()`](scopes.md#release) flushes and releases every cached
  record while keeping adapters and stored data.
- [`silo.diagnostics`](devtools.md) is the inspector's view: an observable
  snapshot of storages, records and the migration version, plus a stream of
  events. Observing it creates no demand.
- `silo.dispose()` is synchronous, void and idempotent. It stops notifications,
  hydration commits and observation, refuses new mutations, rejects outstanding
  `hydrated()` promises, and disposes every chosen adapter. Operations already sent to an adapter may finish, but queued writes are
  discarded. Call `await silo.flush()` before disposing if the last write
  matters.

Whoever constructs the store disposes it. In React the provider holds no state
of its own: mounting it persists nothing and unmounting it discards nothing.

## Types the store derives

`Silo<TStorages>` is generic over the `storages` literal, and a handful of
exported helpers read the same information back out of it:

| Type                            | Answers                                                                                    |
| ------------------------------- | ------------------------------------------------------------------------------------------ |
| `KeyOf<TStorages>`              | Every address: `"theme" \| "secure.token"`.                                                |
| `InferValue<TDefinition>`       | What one definition reads as: `TValue`, plus `undefined` without a fallback.               |
| `InferSchema<TStorages>`        | Every address mapped to what it reads as.                                                  |
| `DefinitionOf<TStorages, TKey>` | The `ValueDefinition` behind one address.                                                  |
| `NativeOf<TStorages>`           | Each storage's native handle, the union of its candidates', which is `silo.native`'s type. |
| `MigrationFor<TStorages>`       | The migration flavour the storages take, for a step declared in another file.              |
| `SiloOptions<TStorages>`        | The constructor's argument, for options built elsewhere.                                   |

```ts
import type { InferSchema, KeyOf } from "@priemskiyyy/silo";

type Address = KeyOf<typeof storages>; // "theme" | "draft"
type Values = InferSchema<typeof storages>; // { theme: "light" | "dark"; draft: string | undefined }
```

Framework bindings register the store once, so their hooks carry these types
without a generic at every call. See [React](react.md).

## One store per application

Two stores over one backend with the same namespace write to the same keys with
no coordination between their snapshots. That is not a supported arrangement; it
is two applications sharing a disk. If you need isolation, give each store its
own `namespace`, and read the collision note in [scopes](scopes.md) before using
`""`.

Tests are the exception: build a store per test with the memory or mock adapter
and dispose it afterwards. See [application testing](testing.md).
