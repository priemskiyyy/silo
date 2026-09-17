---
name: create-adapter
description: Add a Silo storage adapter for a backend. Use when asked to support a new storage engine, database, platform store, or remote key-value service in Silo, or to write a custom adapter inside an application.
---

# Create a Silo adapter

An adapter translates one storage backend onto the Silo contract. The core owns
keys, namespaces, codecs, snapshots, demand, write ordering, coalescing, flush
barriers, expiry, migrations and diagnostics. The adapter reads and writes raw
values at opaque keys, answers whether it can run, and reports changes it did
not make.

## 1. Read before writing

1. `docs/writing-an-adapter.md`: the contract and its rules.
2. `docs/adapters.md`: pick the shipped adapter whose model is closest and copy
   its layout from `packages/adapters/<name>`. The families are:
   - A text backend that answers in the calling frame: `local-storage`,
     `session-storage`, `cookie`, `search-params`, `mmkv`, `sqlite`.
   - A text backend that answers later: `async-storage`, `expo-secure-store`,
     `react-native-keychain`, `capacitor-preferences`, `redis`,
     `cloudflare-kv`, `http`, `icloud`.
   - A structured backend the platform serializes itself: `memory`,
     `indexeddb`, `chrome-storage`, `electron-store`, `tauri-store`,
     `unstorage`, `cloudflare-durable-objects`, `json-file`.
   - A wrapper over another adapter: `simulcast`.
3. `packages/core/src/generators/createStorageAdapter.ts` and
   `createTextStorageAdapter.ts`: what the two generators supply, so the adapter
   does not reimplement it.
4. The backend: whether reads are truly synchronous, whether it holds strings
   or structured values, how it reports a missing key, whether it can throw at
   rest, what it does when quota is exhausted, whether another tab or process
   can change it underneath and whether it echoes the adapter's own writes,
   which characters it accepts in a key, and how it is closed.

## 2. Decide the mapping

Write these down in the package README before coding:

- **`mode`.** `sync` means `get` returns the value itself on every call, with
  no cache warming and no first-read penalty. `localStorage`, MMKV, SQLite and
  an in-process `Map` qualify. A backend whose read is asynchronous even once
  is `async`. Dressing it as `sync` behind a stale cache breaks the guarantee
  the mode exists to make: with a synchronous adapter and no pending
  migration, the first `get()` already returns persisted data.
- **The generator.** `createTextStorageAdapter` for a backend that holds
  strings. The mapping is `read`, `write` and `remove` over text, and the
  generator owns JSON on both sides, treats `stringify` answering `undefined`
  as a removal, throws from `get` on text that will not parse so the core
  reports a hydrate error, and decodes what `observe` reports. Expose
  `format?: TextFormat` so `superjson` or `devalue` drop in.
  `createStorageAdapter` for a backend that keeps structured values, where the
  value passes through as it is. Both add the shared bookkeeping: disposal
  runs once, observers fall silent after it, and a later `get`, `set`,
  `remove` or `keys` throws an error naming the adapter.
- **The value corpus.** Name in the README which values survive. JSON-safe
  everywhere; `Date`, `Map`, `Set` and typed arrays only on a structured-clone
  backend, a `Blob` only where the engine accepts one. The corpus is the honest
  cost of letting adapters own serialization, and it belongs in writing.
- **`available()`.** Required on every adapter. The core probes each candidate
  in a storage's list once, at construction, keeps the first that answers
  `true` and disposes the rest. A platform adapter probes the platform
  (`localStorage` resolves inside a guard, `indexedDb` checks the global,
  `http` checks for a `fetch`). An adapter handed an instance defaults to
  `() => true`. Every adapter exposes `available?: () => boolean` in its
  options to override the probe, so a candidate list can be gated by a consent
  flag or `Platform.OS` at construction.
- **`keyspace`.** Whether the medium wants the store's namespace in its keys.
  Absent means `visible`, which is right for anything shared with other code:
  a storage area, a cookie jar, a Redis keyspace. A medium the page owns, such
  as the query string, declares `keyspace: { namespace: "hidden" }`. When a
  reasonable application could want either, expose a
  `namespace?: "visible" | "hidden"` option and forward it, the way `cookie`
  (default `visible`) and `searchParams` (default `hidden`) do. Never take a
  `prefix`: the core composes the key.
- **`native`.** Which handle an application reaches through `silo.native`. It
  is a plain readonly field, identity stable for the adapter's life, resolved
  lazily through a getter when resolving it touches the platform. If the
  underlying object can be replaced or force-closed, expose a stable wrapper
  over it, the way `indexedDb` exposes `{ name, version, database() }`.
- **`keys`.** Optional. Expose it when the backend can enumerate, because a
  migration enumerates through it. Omit it when it cannot (`expo-secure-store`)
  or when the server has no list (`http({ keys: false })`), and say so.
- **Change reporting.** Optional. Whether the platform can report an external
  write at all, whether it names the key, and whether it echoes the adapter's
  own writes.
- **The instance.** An adapter over an SDK takes the instance the application
  created (`mmkv({ storage })`, `redis({ client })`, `tauriStore({ store })`)
  and types only the members it calls, structurally, so the package depends on
  nothing native and the application keeps the constructor options.

## 3. Implement

- Package at `packages/adapters/<name>`, mirroring the closest adapter:
  `package.json`, `tsconfig.json`, `tsdown.config.ts`, `README.md`, `LICENSE`,
  `src/index.ts`, `src/<factory>.ts`, `src/types/<Factory>AdapterOptions.ts`,
  and a structural type per SDK shape under `src/types/`.
- The factory carries the vendor where one exists: `cloudflareKv`,
  `cloudflareDurableObjectStorage`, `capacitorPreferences`, `electronStore`,
  `tauriStore`. A platform primitive keeps its own name: `cookie`,
  `searchParams`, `mmkv`, `redis`, `sqlite`.
- `package.json`: `@priemskiyyy/silo-<name>`, `sideEffects: false`, `exports`
  with `types` and `import` at `./dist/index.js`, `peerDependencies` on
  `@priemskiyyy/silo` at the matching minor (`>=0.1.0 <0.2`) plus the SDK when
  one is imported at runtime, `files` of `dist`, `README.md` and `LICENSE`.
- `tsdown.config.ts`: `platform: "neutral"` for anything that runs in a
  browser or on a device; `platform: "node"` with `fixedExtension: false` for
  a Node backend, because the node platform emits `.mjs` and the exports name
  `.js`.
- Options are one grouped object, never flat positional arguments, with JSDoc
  and an `@example` on the type and on every optional member.
- Style: `type` not `interface`; no `enum`, `switch`, `any`, `as` casts, the
  `void` operator, `&&` as control flow, or `??=`, `||=` and `&&=`; early
  returns; `typeof x === "function"` guards; `assertUnreachable` at every union
  dispatch; local handlers named `handle*`; one exported arrow per file;
  `src/...` imports; comments say why, never what; no wrapper objects around a
  single value.

Do:

- **Treat the key as opaque.** The core composes
  `${namespace}:${...segments}:${key}` and hands you the result. Store it byte
  for byte. Trimming, lowercasing, splitting on `:` or re-prefixing it orphans
  every value already written, and the conformance suite writes deliberately
  odd keys to catch it. When the backend cannot hold the characters, encode
  reversibly and decode in `keys`, the way `expo-secure-store` uses base64url
  and `electron-store` percent encodes the dot.
- Keep the factory cold: nothing at module import and nothing in the factory
  call. Resolve the platform on first use and memoize it. The
  `window.localStorage` getter itself throws when site data is blocked, so
  resolution belongs inside a guard.
- Return `undefined` for an absent key, and treat `null` as an ordinary stored
  value. `undefined` means absent and nothing else; the core never writes it.
  On a backend that answers `null` for both, ask it which one it was, the way
  `unstorage` calls `hasItem`.
- Implement `dispose()`. It is synchronous even on an async adapter, returns
  nothing, is idempotent, releases observers the adapter registered, and never
  deletes data or closes a connection the application opened.
- **Suppress or tolerate echoes in `observe`.** The core drops an echo of a
  write it made itself, so a platform that reports its own writes
  (`chrome.storage`, MMKV, Tauri) is fine. A platform that does not (`storage`
  event, one memoized `BroadcastChannel`) is better. Never open a second
  channel object to listen on: it reintroduces the echo.
- Report `{ key: null }` when everything changed and the backend cannot say
  which keys, so the core re-reads.
- Throw (sync) or reject (async) on a failed `set` or `remove`. The core
  catches, keeps the optimistic snapshot, and reports
  `{ state: "error", error: { phase: "write" } }`. A platform that drops a write
  in silence, such as a cookie over 4KB, needs a read-back so the failure is
  reported rather than invented as persisted.
- Document backend semantics in the README under `## Behavior`: the corpus,
  quota, consistency, what `keys` and `observe` do or why they are absent,
  what `dispose` releases, and how `available` behaves.

Do not:

- Serialize in `packages/core`. Encoding is the adapter's, and moving it up
  kills structured clone for every backend that has it.
- Deduplicate, coalesce, retry or reference-count anything. The core has a
  single in-flight write with one latest-wins pending slot, and a second layer
  of coalescing underneath it reorders writes.
- Branch on an adapter's `name` anywhere in the core or in another adapter.
  The name is for diagnostics and error messages.
- Fake a capability. `keys` and `observe` are optional, and omitting one is
  the supported answer. An `observe` that never fires, or a `sync` mode over an
  asynchronous read, is worse than an honest absence.
- Set a backend TTL. Expiry is the core's, checked when a raw value arrives.
- Emit a change, resolve a read, or touch the backend after `dispose()`.
- Change `packages/core` because one backend is unusual.

## 4. Test

1. `src/<factory>.fixture.ts`: an in-process fake of the SDK shape the adapter
   types, exported as `createFake<Thing>`, with the listeners and failure hooks
   the tests need. Platform adapters use jsdom instead.
2. `src/conformance.test.ts` calling `testStorageAdapter` from
   `@priemskiyyy/silo/testing` with `{ name, createAdapter }`, plus `values`
   when the backend carries more than JSON-safe data and `externalWrite` when
   it implements `observe`. The suite reads `mode` once and runs one of two
   blocks: the synchronous block never awaits, which is the only construction
   that proves a synchronous adapter is synchronous, and the asynchronous block
   proves every operation returns a promise.
3. `src/<factory>.test.ts` for backend semantics: a cold factory that opens
   nothing, `available` and `format` taken from the options, the absent
   platform path, a refused write, external change delivery and echo handling,
   key encoding round trips, and options passthrough. The shared suite cannot
   check coldness; only this test can.
4. `src/<factory>.contracts.ts`, typechecked and never imported, when the
   adapter types an SDK structurally: each supported client must fit with no
   cast, the way `redis.contracts.ts` constructs `ioredis`, `redis` and
   `@upstash/redis`.
5. Register the package in `vitest.config.ts` with the environment the backend
   needs: `node` for a fake or an in-process backend, `jsdom` for a document,
   a location or a storage area, and `setupFiles: ["fake-indexeddb/auto"]` for
   IndexedDB. `scripts/verify-packages.mjs` packs every directory under
   `packages/adapters` on its own.
6. Run `pnpm build && pnpm lint:typescript && pnpm lint:eslint && pnpm lint:prettier && pnpm test:unit && pnpm test:package`.

## 5. Document

- `docs/adapters.md`: a section under the adapter's family, and a row in the
  comparison table with its mode, what it holds, `keys`, `observe`, and the
  keyspace default.
- `docs/installation.md`: the package in the adapters table.
- The root `README.md` package table, and `CHANGELOG.md` with a dated
  `## @priemskiyyy/silo-<name> <version> - <date>` entry ending in the
  `@priemskiyyy/silo` minor it requires.
- Frontmatter, prose and snippets follow the docs rules: a `description` per
  page, no em dashes, no agent attribution, and every snippet compiles against
  the current API.
