---
description: "Implement the Silo storage adapter contract: sync or async mode, the text and structured generators, opaque keys, the keyspace declaration and conformance."
---

# Writing an adapter

An adapter maps one storage backend onto a small contract and does nothing
else. The core owns keys, codecs, snapshots, demand, write ordering,
coalescing, flush barriers, expiry and migrations. The adapter reads and
writes raw values at opaque keys, says whether its platform is there, and
reports changes it did not make.

Two generators build one. `createTextStorageAdapter` is for a backend that
holds strings, which is most of them: web storage, MMKV, AsyncStorage, a
cookie, Redis, an HTTP key-value resource. `createStorageAdapter` is for a
backend that holds structured values as they are, such as IndexedDB or an
in-process `Map`. Both are exported from `@priemskiyyy/silo`.

## The contract

```ts
import type { KeyspaceDeclaration, StorageChange } from "@priemskiyyy/silo";

export type SyncStorageAdapter<TNative = unknown> = {
  mode: "sync";
  name: string;
  native: TNative;
  get(key: string): unknown;
  set(key: string, value: unknown): void;
  remove(key: string): void;
  keys?(): string[];
  available(): boolean;
  keyspace?: KeyspaceDeclaration;
  dispose(): void;
  observe?(listener: (change: StorageChange) => void): () => void;
};

export type AsyncStorageAdapter<TNative = unknown> = {
  mode: "async";
  name: string;
  native: TNative;
  get(key: string): Promise<unknown>;
  set(key: string, value: unknown): Promise<void>;
  remove(key: string): Promise<void>;
  keys?(): Promise<string[]>;
  available(): boolean;
  keyspace?: KeyspaceDeclaration;
  dispose(): void;
  observe?(listener: (change: StorageChange) => void): () => void;
};
```

Both are exported from `@priemskiyyy/silo` as instances of one
`StorageAdapterShape`; the block above restates them. The two are not
interchangeable in either direction, and the core dispatches on `mode`, never
on `name`.

| Member      | Required | Meaning                                                                                                                             |
| ----------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `mode`      | yes      | `sync` when every operation settles in the calling frame, `async` when any one of them settles later.                               |
| `name`      | yes      | For diagnostics and error messages. The core never branches on it.                                                                  |
| `native`    | yes      | The backend's own handle, identity stable for the adapter's life. `null` where the platform is absent.                              |
| `get`       | yes      | The decoded value at a physical key, `undefined` for an absent one.                                                                 |
| `set`       | yes      | Persists a decoded value. Throws or rejects when the backend refused it.                                                            |
| `remove`    | yes      | Deletes a key. Accepted for a key that was never written.                                                                           |
| `available` | yes      | A cheap synchronous probe of the platform, called once per candidate at construction. Must not open anything.                       |
| `dispose`   | yes      | Synchronous, returns nothing, idempotent. Silences `observe` and refuses later operations.                                          |
| `keys`      | no       | Every physical key the backend holds. A migration reaches scoped data through it, and an application clears a namespace through it. |
| `keyspace`  | no       | `{ namespace: "visible" \| "hidden" }`. Absent means `visible`. See [the keyspace declaration](#the-keyspace-declaration).          |
| `observe`   | no       | Reports a change made outside this store: `{ key, value }` already decoded, or `{ key: null }` when everything changed.             |

## Rules

- **Match `mode` to every operation.** A sync adapter returns values immediately;
  an async adapter returns promises. A first read that needs asynchronous setup
  makes the adapter async, even if later reads could use a cache.
- **Serialize the adapter-level value.** `set` receives the codec's encoded
  value, including an expiry envelope when configured. `get` returns that same
  shape for the core to decode. Text backends serialize and parse it; structured
  backends preserve the supported values directly. Document which types survive
  a round trip.
- **Treat keys as opaque.** The core constructs an address and applies any
  configured key mapping before calling the adapter. Store the resulting key
  unchanged. If a backend restricts key characters, use a reversible encoding
  and decode keys during enumeration and observation.
- **Defer access to the platform.** Do not open storage during module import or
  factory construction. Availability probes must be synchronous and must not
  open a connection. Catch platform-access errors such as a throwing
  `globalThis.localStorage` getter in the probe.
- **`undefined` means absent and nothing else.** `get` returns `undefined` for
  an absent key; `null` is an ordinary stored value that must stay distinct
  from it. The core never calls `set` with `undefined`.
- **Fail loudly.** A failed `set` or `remove` throws (sync) or rejects
  (async). The core catches it, keeps the optimistic snapshot and reports
  `{ state: "error", error: { phase: "write", cause } }`. Swallowing the
  failure makes a full disk look like a successful write.
- **`dispose()` releases what the adapter opened, not the data.** Listeners
  and connections the adapter created go; a database, a file or a cookie jar
  the application handed over stays open and stays populated.
- **Suppress your own echoes where you can.** A committed external change
  bumps the core's mutation counter, so an echo of a local write is a change
  the application did not make. The core drops a report that arrives while
  its own write is in flight, which covers a platform that echoes inside the
  write call. A platform that echoes later needs filtering in the adapter.
- **`native` is identity stable** for the adapter's life. It is a plain field,
  not an observable. If the underlying object can be replaced or force-closed,
  expose a stable wrapper over it rather than the object itself, as the
  IndexedDB adapter does. See [Native access](native-access.md).
- **Do not deduplicate, coalesce or reference-count.** The core has a single
  in-flight write with one latest-wins pending slot, and a second layer of
  coalescing underneath it reorders writes.

### What self-suppression means

The shipped observers are self-suppressing for different reasons, and the
difference matters for anyone writing a third:

- The `storage` event does not fire in the browsing context that made the
  change. The platform suppresses the echo.
- `BroadcastChannel` excludes the posting channel object, not the posting
  context. The IndexedDB adapter posts and listens on one memoized channel, so
  it cannot hear itself; a second Silo adapter in the same tab is a different
  object and does hear it, which is the point. An adapter that opened a second
  channel to listen on would echo every one of its own writes.
- MMKV reports the application's own writes too, in the same call. The core
  drops them, because a local write is in flight when they arrive.

## The options type

Every adapter takes one options object, declared in
`src/types/<Name>AdapterOptions.ts` with JSDoc on each member, grouped rather
than flat. Three members recur across the shipped adapters and should keep
their names:

| Option      | Meaning                                                                                                                                                            |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `available` | Overrides the probe, so a candidate list can be gated by application state at construction: consent, a platform check, a feature flag.                             |
| `format`    | Text adapters only. Replaces JSON with anything that has `stringify` and `parse`, such as `superjson` or `devalue`. Changing it over existing data is a migration. |
| `namespace` | Adapters over a shared medium only. `"visible"` or `"hidden"`, forwarded as the keyspace declaration when the medium's default is not right for every application. |

An adapter that wraps an instance the application creates, such as an MMKV
store or a Redis client, takes it as an option and imports nothing from the
platform package, so the module loads anywhere.

## createTextStorageAdapter

A text mapping describes `read`, `write` and `remove` over strings, and the
adapter owns the JSON on both sides: `stringify` on every write, `parse` on
every read, `undefined` written as a removal, and a text that will not parse
thrown from `get` so the core reports it as a failed hydration. An `observe`
that reports text is decoded the same way, and a report that will not decode
reports `{ key, error: { cause } }` rather than replacing the snapshot.
Use the same report when reading a notified key fails, or `key: null` for an
observation connection failure. Catch backend errors separately from invoking
the listener so a consumer exception is not mistaken for corrupt storage.

```ts
import { createTextStorageAdapter } from "@priemskiyyy/silo";
import type { TextFormat } from "@priemskiyyy/silo";

/** A synchronous native key-value store, the shape MMKV has. */
type NativeStore = {
  getString(key: string): string | undefined;
  set(key: string, value: string): void;
  delete(key: string): void;
  getAllKeys(): string[];
  addOnValueChangedListener(listener: (key: string) => void): {
    remove: () => void;
  };
};

export type NativeKeyValueAdapterOptions = {
  storage: NativeStore;
  /** Overrides the probe. Defaults to always available, since the instance was handed over. */
  available?: () => boolean;
  /** How values become text and back. Defaults to `JSON`. */
  format?: TextFormat;
};

export const nativeKeyValue = ({
  storage,
  available = () => true,
  format,
}: NativeKeyValueAdapterOptions) => {
  const stops = new Set<() => void>();

  return createTextStorageAdapter({
    mode: "sync",
    name: "native-key-value",
    native: storage,
    format,
    read: (key) => storage.getString(key),
    write: (key, text) => storage.set(key, text),
    remove: (key) => storage.delete(key),
    keys: () => storage.getAllKeys(),
    available,
    // The data belongs to the instance and stays; a listener the consumer
    // never stopped is released here.
    dispose: () => {
      for (const stop of [...stops]) {
        stop();
      }
    },
    observe: (listener) => {
      // The platform reports the key alone, so the text is read back.
      const subscription = storage.addOnValueChangedListener((key) =>
        listener({ key, text: storage.getString(key) }),
      );
      const stop = () => {
        stops.delete(stop);
        subscription.remove();
      };

      stops.add(stop);

      return stop;
    },
  });
};
```

`read` may answer `null` or `undefined` for an absent key, whichever the
platform says. An asynchronous mapping is the same shape with `read`, `write`,
`remove` and `keys` returning promises, and the overload picks the contract
from `mode`. `format` is forwarded as it is, `undefined` included, so the
adapter never spreads it conditionally.

## createStorageAdapter

For a structured backend, the mapping is the contract itself, and the
generator supplies the bookkeeping every adapter needs:

- `dispose()` runs the inner `dispose` at most once.
- `observe` listeners fall silent after disposal, including one a consumer
  never stopped, and including a change the backend already had in flight.
- A `get`, `set`, `remove` or `keys` after disposal throws an error naming
  the adapter and the key.
- `native` is read through an accessor, so a backend resolved lazily is not
  opened by the wrapper.
- `available` and `keyspace` pass through, and an absent `keys` or `observe`
  stays absent rather than becoming a member that answers nothing.

```ts
import { createStorageAdapter } from "@priemskiyyy/silo";

/** A structured backend that settles later, such as a table with structured clone. */
type Table = {
  read(key: string): Promise<unknown>;
  write(key: string, value: unknown): Promise<void>;
  drop(key: string): Promise<void>;
  list(): Promise<string[]>;
  close(): void;
};

export type RemoteTableAdapterOptions = {
  table: Table;
  available?: () => boolean;
};

export const remoteTable = ({
  table,
  available = () => true,
}: RemoteTableAdapterOptions) =>
  createStorageAdapter({
    mode: "async",
    name: "remote-table",
    native: table,
    get: (key) => table.read(key),
    // Resolve when the write is durable, not when it is accepted: `flush()`
    // resolving is the promise this makes to the application.
    set: (key, value) => table.write(key, value),
    remove: (key) => table.drop(key),
    keys: () => table.list(),
    available,
    // Synchronous on both modes, because the core disposes from paths that
    // cannot await.
    dispose: () => table.close(),
  });
```

The conformance suite asserts every one of the generator's behaviors, so an
adapter written without it has to reimplement them all.

## The keyspace declaration

The store composes keys as `${namespace}:${key}` so that several applications,
libraries and Silo stores can share one backend without colliding. That is
right for `localStorage` and a cookie jar, and wrong for a query string the
page owns: `?silo%3Anote=hello` is not a link anyone wants to share.

An adapter says which kind of medium it is with `keyspace`. `{ namespace:
"hidden" }` tells the store to leave the prefix out of this adapter's keys
when it wins its list; absent or `{ namespace: "visible" }` keeps it. The
declaration is read from the candidate that won, so a store whose search
params adapter lost to `memory()` still gets a prefix in memory, where it
costs nothing. A storage's own `namespace` option overrides the declaration
either way.

`searchParams()` declares `hidden` and `cookie()` declares `visible`, and both
take a `namespace` option that forwards the other value. Most adapters declare
nothing: a private file, a KV binding or a keychain service is not shared with
anything that could collide. See [Storages and namespaces](storages.md).

## Package layout

A package at `packages/adapters/<name>` mirrors the closest shipped adapter:

```
package.json          @priemskiyyy/silo-<name>, peer dependency on @priemskiyyy/silo
tsconfig.json
tsdown.config.ts
README.md
LICENSE
src/index.ts          exports the factory and the options type, nothing else
src/<name>.ts         the factory, one exported arrow function
src/<name>.fixture.ts a fake of the supplied instance, when there is one
src/<name>.test.ts    backend semantics
src/conformance.test.ts
src/types/<Name>AdapterOptions.ts
```

The README follows the shipped ones: `## Installation`, `## Create a silo`
with the factory in a candidate list that ends in `memory()`, `## Behavior` for
the backend's semantics, which values survive, what `observe` hears and what
`native` is, then `## License`.

## Test it

Every adapter runs the shared conformance suite, and backend-specific
behavior gets its own tests beside it:

```ts
import { testStorageAdapter } from "@priemskiyyy/silo/testing";
import { nativeKeyValue } from "src/nativeKeyValue";
import { createFakeNativeStore } from "src/nativeKeyValue.fixture";

testStorageAdapter({
  name: "native-key-value",
  createAdapter: () => nativeKeyValue({ storage: createFakeNativeStore() }),
  externalWrite: (adapter, change) => {
    if (change.key === null) {
      adapter.native.getAllKeys().forEach((key) => adapter.native.delete(key));
      return;
    }

    adapter.native.set(change.key, JSON.stringify(change.value));
  },
});
```

[Testing an adapter](testing-adapters.md) covers the options, the value
corpus, the `externalWrite` harness, the enumeration block, fakes, and what the
suite cannot catch: a cold factory, quota behavior and anything real
cross-tab. Register the package as a Vitest project in the root
`vitest.config.ts`, add it to `docs/adapters.md`, `docs/installation.md` and
the README adapter table, and run `pnpm check`.
