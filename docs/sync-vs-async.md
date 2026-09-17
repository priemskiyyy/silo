---
description: "Why a synchronous Silo storage reads persisted data in the first frame, how a candidate list fixes the mode, and why the adapter contract is two types."
---

# Synchronous and asynchronous

`localStorage` answers in the calling frame. IndexedDB answers in a later
task. No library can change that. What Silo does is put the difference in
exactly one place: **when the persisted value reaches the snapshot**.
Everything you call is the same on both.

## The two timelines

On a synchronous storage, hydration happens inside `silo.value(key)`, before
the handle is returned:

```text
frame 0  new Silo({ storages: { default: { adapters: [localStorage()], schema } } })
frame 0  silo.value("theme")   -> adapter.get("silo:theme") -> "dark"
                                  status: ready
frame 0  theme.get()           -> "dark"          the persisted value
```

On an asynchronous storage the read cannot finish in that frame, so the
snapshot holds the fallback until it does:

```text
frame 0  new Silo({ storages: { default: { adapters: [indexedDb()], schema } } })
frame 0  silo.value("theme")   -> adapter.get("silo:theme") -> Promise
                                  status: hydrating
frame 0  theme.get()           -> "light"         the fallback
  ...
later    the read resolves     -> "dark"
                                  status: ready, subscribers notified
later    theme.get()           -> "dark"
```

Both are correct. Only the first is flash free.

## What that looks like in code

```ts
import { Silo, value } from "@priemskiyyy/silo";
import { localStorage } from "@priemskiyyy/silo-local-storage";

const local = new Silo({
  storages: {
    default: {
      adapters: [localStorage()],
      schema: { theme: value({ fallback: "light" }) },
    },
  },
});
const theme = local.value("theme");

theme.status.get(); // { state: "ready" }, already
theme.get(); // the persisted value, not the fallback
```

With no pending migration, a synchronous storage hydrates inside `value(key)`.
The returned handle is `ready`, or `error` if reading or decoding failed. A
pending asynchronous migration can keep a synchronous value `hydrating` until
admission opens.

```ts
import { indexedDb } from "@priemskiyyy/silo-indexeddb";

const indexed = new Silo({
  storages: {
    default: {
      adapters: [indexedDb({ name: "acme" })],
      schema: { draft: value({ fallback: "" }) },
    },
  },
});
const draft = indexed.value("draft");

draft.status.get(); // { state: "hydrating" }
draft.get(); // "", the fallback

await draft.hydrated();

draft.get(); // the persisted value
```

`hydrated()` is the only call that has to exist for the asynchronous case,
and it exists on both: on a synchronous storage it is an already settled
promise. Code that awaits it works everywhere, which is what lets an
application move from `localStorage` to IndexedDB without an audit.

## The list decides the mode

A storage is a list of candidate adapters, and the winner is chosen at
construction. Its **mode is fixed by the list, not by the winner**: a
storage whose list contains any asynchronous adapter runs asynchronously
even on a device where a synchronous candidate won.

```ts
const silo = new Silo({
  storages: {
    default: { adapters: [localStorage(), memory()], schema }, // synchronous
    journal: { adapters: [indexedDb(), memory()], schema: entries }, // asynchronous, even when memory wins
  },
});
```

The reason is that the first frame of your application must not depend on
which candidate a particular browser happened to accept. With the list
deciding, a value in `journal` reads as its fallback on the first frame on
every device, and a value in `default` reads as the persisted one on every
device. An application that wants the synchronous guarantee lists only
synchronous adapters, and a list that ends in `memory()` keeps it, because
`memory()` is synchronous.

The same rule types your migrations. When every storage's list is
synchronous, `migrations` are `SyncMigration` and run inside the constructor.
One asynchronous candidate anywhere makes them `AsyncMigration`, because a
migration reaches every storage and the slowest decides. See
[migrations](migrations.md) for the fast path that still opens the gate in
the first frame when the default storage is synchronous.

## Adapters by mode

| Mode         | Adapters                                                                                                                                                                                                |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| synchronous  | `memory`, `localStorage`, `sessionStorage`, `cookie`, `searchParams`, `mmkv`, `sqlite`, `jsonFile`, `electronStore`                                                                                     |
| asynchronous | `indexedDb`, `asyncStorage`, `secureStore`, `keychain`, `icloud`, `capacitorPreferences`, `chromeStorage`, `tauriStore`, `http`, `redis`, `cloudflareKv`, `cloudflareDurableObjectStorage`, `unstorage` |
| the wrapped  | `simulcast(...)` keeps the mode of the adapter it wraps                                                                                                                                                 |

[Choose an adapter](adapters.md) has the full comparison.

## Why the contract is two types

The adapter contract is split, and the split is real:

```ts
type Sync = {
  mode: "sync";
  get(key: string): unknown;
  set(key: string, value: unknown): void;
  remove(key: string): void;
};

type Async = {
  mode: "async";
  get(key: string): Promise<unknown>;
  set(key: string, value: unknown): Promise<void>;
  remove(key: string): Promise<void>;
};
```

Both contracts derive from `StorageAdapterShape`. The `mode` field tells the
core whether to execute an operation inline or wait for its promise. Keeping
the contracts separate preserves synchronous hydration and gives migration
callbacks the appropriate return types.

Because a synchronous read returns `unknown`, TypeScript alone cannot reject
every incorrectly returned promise. The [conformance suite](testing-adapters.md)
checks the runtime return values for both modes.

## Why your code stays uniform anyway

Because **reads never touch the adapter**. The store owns a snapshot per key.
The adapter is consulted once when a value is hydrated, and again when a
change arrives from outside, and `get()` reads the snapshot every time. That
is also why decoding runs once per inbound value rather than per read, which
is what keeps snapshot identity stable for `useSyncExternalStore`.

With successful reads and no pending migration, the main timing differences are:

| Question                                | Synchronous storage                       | Asynchronous storage            |
| --------------------------------------- | ----------------------------------------- | ------------------------------- |
| First `get()` after `value(key)`        | The persisted value                       | The fallback                    |
| Is `{ state: "hydrating" }` observable? | Only while migration admission is pending | Yes, until the first read lands |
| First paint in React                    | Correct immediately                       | Fallback, then a rerender       |

## Choosing

Pick a synchronous storage when the value is visible on first paint: a
theme, a locale, a collapsed sidebar, a dismissed banner. A flash of the
fallback is a visible bug, and there is no way to await your way out of it
during a render.

Pick IndexedDB, or any other asynchronous backend, when the data is too large
for the web storage budget, is not JSON, or lives somewhere a frame cannot
reach: a keychain, a server, a Redis. Then either gate the first frame on
[status](reactive-values.md) or design the fallback to be a legitimate empty
state.

One store can hold both. Name a storage per need, keep the flash-sensitive
keys in a synchronous one, and address the rest as `storage.key`. See
[storages and namespaces](storages.md).
