---
description: "Several storages in one Silo store: candidate adapters chosen by availability, a schema per backend, storage.key addressing, namespaces and physical keys."
---

# Storages and namespaces

A named storage groups a schema with an adapter list. Use several storages when
values need different backends: localStorage for preferences, IndexedDB for
documents, or the URL for filters.

```ts
import { Silo, value } from "@priemskiyyy/silo";
import { indexedDb } from "@priemskiyyy/silo-indexeddb";
import { localStorage } from "@priemskiyyy/silo-local-storage";
import { memory } from "@priemskiyyy/silo-memory";
import { searchParams } from "@priemskiyyy/silo-search-params";

export const silo = new Silo({
  namespace: "acme",
  storages: {
    default: {
      adapters: [localStorage(), memory()],
      schema: { theme: value<"light" | "dark">({ fallback: "light" }) },
    },
    journal: {
      adapters: [indexedDb({ name: "acme" }), memory()],
      schema: { entries: value<string[]>({ fallback: [] }) },
    },
    url: {
      adapters: [searchParams(), memory()],
      schema: { filter: value<"all" | "starred">({ fallback: "all" }) },
    },
  },
});

silo.value("theme").get(); // "light" | "dark", from localStorage
silo.value("journal.entries").get(); // string[], from IndexedDB
silo.value("url.filter").get(); // "all" | "starred", from the query string
```

## Options

| Option      | Meaning                                                                                                                               |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `adapters`  | Candidates in order of preference. The first whose `available()` passes wins; the last is taken regardless. At least one is required. |
| `schema`    | The keys that live in this storage, as `value(...)` entries. See [Schema and codecs](schema-and-codecs.md).                           |
| `namespace` | Prefix on this storage's physical keys, overriding the store's. `""` drops the prefix.                                                |

`default` is required: its keys are addressed bare, and it holds the migration
version record. Every other storage is addressed as `storage.key`. A storage
name must be non-empty and must not contain `.`, because `.` is what joins it
to a key.

## Candidates and availability

Silo tries candidates in order. A candidate must pass `available()`, expose its
native handle, and attach its observer if it has one. A false probe or a thrown
error skips that candidate. The final candidate follows the same rules.

If none initializes, construction throws an `AggregateError` naming the storage;
its `errors` contain each candidate failure and the original causes. Unselected
adapters are disposed. Cleanup failures still abort construction.

```ts
const storages = {
  default: {
    // Fall back when localStorage is absent or access to it is blocked.
    adapters: [localStorage(), memory()],
    schema: Schema,
  },
};
```

Add `memory()` when losing data on reload is acceptable. If persistence is
required, handle storage errors instead of treating memory as a successful save.
[Devtools](devtools.md) shows which adapter was selected.

Every shipped adapter takes an `available` option that replaces its probe, so a
list can be gated by application state:

```ts
adapters: [localStorage({ available: () => consent.granted }), memory()];
```

The choice is made once. The probe is synchronous and does not await a connection
or database open. A selected IndexedDB adapter can subsequently fail to open;
that failure appears in [status](errors-and-recovery.md) without trying memory.
For explicit initialization before selection, see the
[IndexedDB startup recipe](recipes.md#check-indexeddb-before-startup).

## Mode follows the list

A storage is synchronous only when every candidate in its list is. One
asynchronous candidate anywhere makes the storage asynchronous, whichever
candidate wins, because the type of `migrations` and the timing of first reads
are decided at compile time and cannot depend on a probe. See
[Synchronous and asynchronous](sync-vs-async.md).

The same rule crosses storages for migrations: they are synchronous when every
storage is, and asynchronous as soon as one is not, because a migration
reaches every storage and the slowest decides. See [Migrations](migrations.md).

## Native handles

`silo.native` holds the chosen adapter's own client per storage, typed as the
union of that storage's candidates:

```ts
silo.native.default; // Storage | null | Map<string, unknown>
silo.native.journal; // IndexedDbHandle | Map<string, unknown>
```

`NativeOf<typeof storages>` names that type. See [Native access](native-access.md).

## Physical keys

Every value has one physical key, composed by the core and treated as opaque
by the adapter:

```text
${namespace}:${...scopeSegments}:${key}
```

| Store `namespace` | Storage        | Call                                   | Physical key         |
| ----------------- | -------------- | -------------------------------------- | -------------------- |
| `"acme"`          | `default`      | `silo.value("theme")`                  | `acme:theme`         |
| `"acme"`          | `journal`      | `silo.value("journal.entries")`        | `acme:entries`       |
| `"acme"`          | `default`      | `silo.scope("users:7").value("theme")` | `acme:users:7:theme` |
| `"acme"`          | `url` (hidden) | `silo.value("url.filter")`             | `filter`             |
| `""`              | `default`      | `silo.value("theme")`                  | `theme`              |

The storage name is not part of the key. Two storages over the same medium
with the same namespace and the same key name collide, so give them different
namespaces or different keys. The migration version lives at
`${namespace}::version` in the default storage, and the store refuses any
value whose physical key would equal it.

## Which namespace applies

A storage's namespace is resolved once the winning adapter is known, in this
order:

1. The storage's own `namespace`, when it declares one.
2. The winning adapter's keyspace declaration: `hidden` means no prefix.
3. The store's `namespace`.
4. `"silo"`.

An adapter declares how its medium wants the namespace through
`keyspace: { namespace: "visible" | "hidden" }`. A shared medium such as
`localStorage` or a cookie jar wants it visible, because other libraries write
there too. A query string the page owns wants it hidden, so a link reads
`?filter=starred` rather than `?acme%3Afilter=starred`. The search params
adapter declares `hidden` by default and the cookie adapter `visible`, and both
take a `namespace` option to flip it.

Because the declaration belongs to the adapter that won, a list is safe to
mix:

```ts
url: {
  // If the URL is unavailable, memory wins and keys carry the prefix; if the
  // URL wins, its declaration hides it. Either way the link stays clean.
  adapters: [searchParams(), memory()],
  Schema: { filter: value<"all" | "starred">({ fallback: "all" }) },
},
```

Set the storage's own `namespace` to pin the answer regardless of the winner:
`namespace: "acme"` keeps the prefix in the URL, `namespace: ""` drops it from
a cookie jar the application owns.

`""` is the deliberate opt-in to a shared keyspace. Use it for a store that
must read keys something else already writes, and read the collision note in
[Scopes](scopes.md#do-not-mix-an-empty-namespace-with-scopes) first.

## Changes stay in their storage

An adapter that implements `observe` reports changes made outside the store,
and the store routes each one to the records of the storage that reported it.
A `storage` event from `localStorage` never touches the IndexedDB records,
even when both hold a key named `note`. See
[External observation](external-observation.md).

## A worked example

The [Fieldbook example](examples.md) declares the same `note` and `count` keys
in eight storages, so the same field can be pointed at each medium in turn:

| Storage       | Adapters                                                         | Why it is there                                                          |
| ------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `memory`      | `memory()`                                                       | Session-only fallback; data is lost on reload.                           |
| `default`     | `localStorage()`, `memory()`                                     | Synchronous, so the theme is right on the first frame.                   |
| `session`     | `sessionStorage()`, `memory()`                                   | This tab only.                                                           |
| `journal`     | `indexedDb()`, `memory()`                                        | Structured clone: a `Date`, a `Set` and a `Map` come back as themselves. |
| `url`         | `searchParams()`, `memory()`                                     | Shareable: the address bar changes as you type.                          |
| `shared`      | `searchParams({ hash: true, sharing: "cross-tab" })`, `memory()` | The fragment, kept in step with the other tabs on the path.              |
| `preferences` | `cookie()`, `memory()`                                           | The one preference a server wants on every request.                      |
| `remote`      | `simulcast(http())`, `memory()`                                  | A REST key-value server, with a realtime channel announcing writes.      |

Its store sets `namespace: "fieldbook"`, so localStorage holds
`fieldbook:theme`, the cookie is named `fieldbook:units`, and the URL, because
the search params adapter hides the namespace, reads `?note=hello`, with the
synced copy in the fragment as `#note=hello`.
