---
description: "Reach the backend under a Silo storage with silo.native: what each adapter exposes, how NativeOf types a candidate list, and what a raw write bypasses."
---

# Native access

`silo.native` exposes each selected adapter's underlying client or handle. Use
it for backend operations that Silo does not expose, such as inspecting a
database connection.

```ts
import { Silo, value } from "@priemskiyyy/silo";
import { memory } from "@priemskiyyy/silo-memory";

const silo = new Silo({
  storages: {
    default: {
      adapters: [memory()],
      schema: { theme: value<"light" | "dark">({ fallback: "light" }) },
    },
  },
});

// Map<string, unknown>, the adapter's own store, typed exactly.
export const keys = [...silo.native.default.keys()];
```

The type comes from the adapters, through `NativeOf<TStorages>`, so nothing
has to be annotated and nothing is `unknown` unless an adapter says so.

## A union per storage

A storage is a list of candidates, and which one wins is decided at
construction, so `silo.native.<storage>` is the **union of every candidate's
native type**:

```ts
import { localStorage } from "@priemskiyyy/silo-local-storage";
import { indexedDb } from "@priemskiyyy/silo-indexeddb";

const silo = new Silo({
  storages: {
    default: { adapters: [localStorage(), memory()], schema: Schema },
    journal: {
      adapters: [indexedDb({ name: "acme" }), memory()],
      schema: entries,
    },
  },
});

silo.native.default; // Storage | null | Map<string, unknown>
silo.native.journal; // IndexedDbHandle | Map<string, unknown>
```

Narrow before use, with whatever the union offers. `instanceof` for a `Map`
or a `Storage`, a property check for a handle, and `null` for a platform that
is not there:

```ts
export const persisted = () => {
  const storage = silo.native.default;

  if (storage === null) {
    return "nothing: site data is blocked or this is a server";
  }

  if (storage instanceof Map) {
    return "this session only";
  }

  // Everything in the area, including keys this store did not write.
  return `${storage.length} keys in localStorage`;
};
```

`silo.diagnostics.get().storages` names the adapter that won each storage
when a check by type is not enough. See [devtools](devtools.md).

## What each adapter exposes

| Adapter                                                | `native`                                           | Absent when                                |
| ------------------------------------------------------ | -------------------------------------------------- | ------------------------------------------ |
| `memory()`                                             | `Map<string, unknown>`, the backing store          | never                                      |
| `localStorage()`, `sessionStorage()`                   | `Storage \| null`                                  | no DOM, or site data blocked               |
| `cookie()`                                             | `Document \| null`                                 | no DOM, or cookies disabled                |
| `searchParams()`                                       | `Location \| null`                                 | no `location` or no `history`              |
| `indexedDb()`                                          | `IndexedDbHandle`, `{ name, version, database() }` | never; the call inside it can still reject |
| `http()`                                               | `{ url }`, the base URL                            | never                                      |
| `jsonFile()`                                           | `{ path }`, the absolute path                      | never                                      |
| `sqlite()`, `redis()`, `mmkv()`, `asyncStorage()`, ... | The instance or module the factory was handed      | never                                      |
| `simulcast({ adapter })`                               | The wrapped adapter's own                          | as the wrapped adapter                     |

A `null` native indicates that the platform API is absent, and it
is what the browser adapters report on a server. It is not an error state
and nothing throws for it.

## Identity stability

`native` is a stable handle, not an observable, and the contract
requires it to be identity stable for the adapter's life. The conformance
suite asserts it. Two consequences:

- The core reads it once, when the store is constructed, and
  `silo.native.<storage>` returns that same value forever.
- It is safe in a dependency array and safe to hold.

For the browser adapters this is what resolves the platform: the adapter
exposes a memoizing accessor, and constructing the store is the first read. A
test that installs a `localStorage` after the store already exists sees
`silo.native.default` stay `null`, because the answer was settled at
construction. Build the store after the environment.

## Why IndexedDB returns a handle

`silo.native.journal` for `indexedDb()` is not the `IDBDatabase`. It is:

```ts
export type IndexedDbHandle = {
  name: string;
  version: number | undefined;
  database: () => Promise<IDBDatabase>;
};
```

An `IDBDatabase` is not identity stable and cannot be made so. The browser
closes it when another tab needs a version upgrade, and the adapter closes
it itself on `versionchange` so it is never the connection that blocks
someone else. Whoever held the raw object then holds a dead handle with no
way to reopen it. The handle is stable, and `database()` reopens if the
connection was dropped:

```ts
export const count = async () => {
  const handle = silo.native.journal;

  // The list ends in memory(), so the handle is a union until narrowed.
  if (handle instanceof Map) {
    return handle.size;
  }

  // Call it, do not store what it returns.
  const database = await handle.database();

  return await new Promise<number>((resolve, reject) => {
    const request = database
      .transaction("values", "readonly")
      .objectStore("values")
      .count();

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};
```

`name` and `version` are what the factory was given, so a caller can open its
own connection on the same database without repeating the configuration.
`version` is `undefined` when the adapter opens whatever version already
exists, which is the default.

## A client you already own

For a backend the application connects itself, `native` is that client, and
reaching it through the store is a convenience rather than a necessity:

```ts
import Redis from "ioredis";
import { redis } from "@priemskiyyy/silo-redis";

const client = new Redis(process.env.REDIS_URL);
const server = new Silo({
  storages: {
    default: { adapters: [redis({ client, match: "silo:*" })], schema: Schema },
  },
});

server.native.default === client; // true
```

`native` is typed as the part of the client the adapter calls, `get`, `set`,
`del` and `keys`, so the adapter depends on no client package. For anything
else, such as an `expire`, call the client you constructed. The store never
closes a client it did not open: `dispose()` on such an adapter releases
nothing, and quitting the client stays your call.

## What a native write bypasses

- **The codec.** A raw written through `native` is stored as is: no `encode`,
  no expiry envelope, no validation.
- **The notification.** The snapshot does not change, and nobody is told,
  unless the adapter [observes](external-observation.md) its own backend and
  the platform reports the write. The `storage` event does not fire in the
  tab that wrote, so a native `localStorage.setItem` in this tab is invisible
  to this store until the next hydration.
- **The barrier.** `flush()` knows nothing about it.

Reading is safe, and raw. No codec runs, so a key that declares `expires` is
seen as its `{ value, expires: { at } }` envelope, and a text backend hands
back the string it stored. Keys are physical:
`${namespace}:${...segments}:${key}`, namespaced `silo` by default. See
[storages and namespaces](storages.md).

## After disposal

`silo.dispose()` disposes the adapter too. Every operation through the
adapter object itself then throws an error naming it, and `indexedDb()`
closes its connection so `native.database()` rejects. A client you handed
over, such as a Redis or an MMKV instance, is untouched.

## In React

`useNativeStorage()` returns the same object, typed by the registered store:

```tsx
import { useNativeStorage } from "@priemskiyyy/silo-react";

export const StorageSize = () => {
  const { default: storage } = useNativeStorage();

  if (storage === null || storage instanceof Map) {
    return <p>No persistent storage</p>;
  }

  return <p>{storage.length} keys</p>;
};
```

The type is `unknown` per storage until `Register` is augmented, at which
point it follows the candidate lists exactly. It observes nothing and creates
no demand: `native` never changes, so there is nothing to subscribe to. See
[React](react.md).
