# Changelog

## Unreleased

- Add an Expo example with scoped drafts, user preferences, SecureStore, and cache release.
- Put the browser notebook first, improve phone navigation and recovery controls, and confirm notebook deletion.

- Infer schema and codec value types independently from fallbacks, preserving enum types and rejecting incompatible fallbacks.
- Use Zod schemas in the quickstarts and Fieldbook example, with inferred types and coercion for URL numbers.
- Check every adapter candidate, including the final one. Failed synchronous probes, native access, and observer setup try the next candidate; exhaustion reports all causes.
- Add `value.reload()` to retry reads without replacing handles, with pending-write protection and cancellation on scope release or disposal.
- Report external parse and notification failures through status and diagnostics while retaining the current value. Value errors now include the `read` phase.
- Add a complete multiworkspace and user-key recipe and use PascalCase schema constants throughout the examples.
- Memory: copy values without `structuredClone` when the runtime has none, so the adapter works in a bare React Native app on Hermes instead of failing every read and write.
- react-native-keychain: decode service names without `TextDecoder`, which Hermes lacks, so `keys` and the migrations that list keys work in a bare React Native app. A name whose bytes are not UTF-8 is now skipped as foreign.

## Unreleased

- Docs: shorter setup guides, workspace and draft examples, explicit migration retry and adapter-selection limits, and a backend test-coverage matrix. Regression tests cover failed migration checkpoints and asynchronous failures after selection.
- Core: optional per-storage `keys: { encode, decode }` preserves existing physical keys. Migrations translate keys in both directions, and scope release uses logical scope membership.
- React, Vue, Solid, Svelte: `useValue` and `useValueStatus` accept explicit value handles without a provider or registration. Reactive inputs retarget subscriptions; missing handles are rejected.

## @priemskiyyy/silo 0.1.0 - 2026-09-17

- First release. `Silo` takes named `storages`, each a schema of `value` entries and an ordered candidate list of adapters. The first candidate whose `available()` passes at construction is kept for the store's life, the last is taken regardless, and the rest are disposed, so a list ending in `memory()` always constructs. Keys of the default storage are addressed bare, keys of every other storage as `storage.key`, and the same key may live in several storages.
- A `SiloValue` per key: `get`, `set`, `remove`, `subscribe`, `status`, `hydrated` and `flush`. `get()` is synchronous on both adapter modes and returns the stored reference. A key that declares a `fallback` reads as its value type with no `| undefined`; a key without one reads as `TValue | undefined`, carried by `ValueDefinition<TValue, TFallback>`.
- `value({ schema })` validates every raw value with any Standard Schema validator, so Zod, Valibot and ArkType work with no runtime dependency; `value({ codec })` translates in both directions. A key with neither trusts what is on disk. A failed `decode` reports `{ state: "error", error: { phase: "hydrate" } }`, falls back to the declared fallback and leaves the stored raw value untouched, because a codec change is far likelier than a corrupt disk.
- Physical keys are `${namespace}:${...segments}:${key}`, namespaced `silo` by default. A storage may carry its own `namespace`, and an adapter may declare `keyspace: { namespace: "hidden" }` for a medium the page owns, such as the query string; the storage's namespace wins over the winning adapter's declaration, which wins over the store's. `""` is the deliberate opt-in to a shared keyspace.
- `scope(segment)` derives a nested keyspace carrying the same storages, `clear()` removes every schema key at that scope, and `release()` on a scope or the store flushes and releases cached records without deleting storage. Disposal clears retained records and diagnostic listeners; released handles keep their last snapshots and become inactive.
- A single in-flight write per record with one latest-wins pending slot, `flush()` as the durability barrier, and external changes that only commit while nothing local is in flight. Reduced per-record allocations, lazy hydration promises and reuse of unchanged diagnostic summaries.
- Failure is a status, never a throw: `ValueStatus` and `SiloStatus` carry `{ state: "error", error: { phase, cause } }`, with `phase` narrowed to `hydrate` or `write` on a value and `migrate` on the store.
- `expires: { in }` or `expires: { at }` envelopes only the keys that declare it, and expiry is checked when a raw value is committed. `now` is injectable, so tests never touch real timers.
- `migrations` are keyed by the positive integer version each step produces, run in ascending order for every step above the stored version, and checkpoint each step as it lands, so a later failure never runs it again. Steps are synchronous when every candidate of every storage is, asynchronous as soon as one is. The migration store reaches every storage through `storage(name)`, lists a namespace's keys with `keys()`, and carries `copy`, `move` and `rename`. A failed step is reported on `silo.status`, closes the store to reads and writes, and leaves the stored version for the next start. When the default storage is synchronous and no step is pending, the gate opens in the constructor's frame, so a synchronous first read stays synchronous on a mixed set.
- The adapter contract requires `available()` and `dispose()`, and leaves `keys`, `observe` and `keyspace` optional. `createStorageAdapter` adds idempotent disposal, silence after it and a named refusal for every later call; `createTextStorageAdapter` builds an adapter over a backend that holds strings, owning JSON on both sides with a `format` for `superjson`, `devalue` or anything with `stringify` and `parse`.
- `silo.diagnostics` is an observable snapshot of every storage, the migration version and every cached record, plus a stream of events. Observing it creates no demand.
- `@priemskiyyy/silo/testing` exports `testStorageAdapter`, the conformance suite every adapter runs, with observation and enumeration blocks for adapters that expose `observe` or `keys`. `@priemskiyyy/silo/mock` exports `createMockAdapter`, which records every call, holds operations open, and emits echoes, duplicates, stale values and post-dispose changes on demand.

## @priemskiyyy/silo-memory 0.1.0 - 2026-09-17

- First release. A `Map` backed synchronous adapter that `structuredClone`s on write and read, so a mutation of what you stored cannot reach persisted state. `keys` lists the map. `available` overrides the probe, which otherwise always passes, so the adapter is the floor every candidate list ends in.
- Requires `@priemskiyyy/silo` 0.1.

## @priemskiyyy/silo-local-storage 0.1.0 - 2026-09-17

- First release. A synchronous adapter over `localStorage`, JSON encoded internally, with `format` for values JSON cannot spell.
- Nothing runs at import or in the factory. The `Storage` is resolved on first use inside a guard, because the `window.localStorage` getter itself throws when site data is blocked. `available` overrides that probe.
- `observe` uses the `storage` event filtered by `event.storageArea`, which is what distinguishes the two web storage areas; `event.key === null` reports that everything changed. `keys` walks the storage area.
- On the server, `get` returns `undefined`, `keys` is empty, `set` and `remove` throw a named error, and `native` is `null`.
- Requires `@priemskiyyy/silo` 0.1.

## @priemskiyyy/silo-session-storage 0.1.0 - 2026-09-17

- First release. The `sessionStorage` counterpart of `@priemskiyyy/silo-local-storage`, with the same lazy resolution, the same `storageArea` filter, the same `keys` and the same options.
- Requires `@priemskiyyy/silo` 0.1.

## @priemskiyyy/silo-indexeddb 0.1.0 - 2026-09-17

- First release. An asynchronous adapter that creates and consumes one transaction per operation in a single synchronous stretch, awaiting only IDB events, so a transaction is never auto-committed by an unrelated await.
- Values are stored as they are, so a `Date`, a `Map` or a `Blob` survives structured clone. `keys` reads the store's keys and keeps the string ones.
- `versionchange` closes the database and `close` drops the cached handle, so a reopen happens on next use rather than failing.
- Cross-tab observation over `BroadcastChannel` keyed on the database name, with `{ sharing: "single-tab" }` to opt out. `available` overrides the probe for the `indexedDB` global.
- `native` is an identity-stable `{ name, version, database() }` handle rather than the `IDBDatabase`, which can be force-closed. The database is chosen with `name`, the object store with `store`.
- Requires `@priemskiyyy/silo` 0.1.

## @priemskiyyy/silo-cookie 0.1.0 - 2026-09-18

- First release. A synchronous adapter over `document.cookie`: the cookie name is the physical key and the value its JSON, both URI encoded, for the values a server must see on every request. `path` defaults to `/`, `maxAge` is in seconds and omitted means a session cookie; `domain`, `secure` and `sameSite` are forwarded.
- A write the browser drops in silence, over the size limit, `secure` on plain HTTP or on a path the page cannot see, is reported as a failed write rather than as persisted.
- `namespace` decides whether the store's namespace is visible in the cookie names, `visible` by default because a cookie jar is shared by the whole site. `keys` lists every cookie the page can see. Nothing is observed.
- Requires `@priemskiyyy/silo` 0.1.

## @priemskiyyy/silo-search-params 0.1.0 - 2026-09-18

- First release. A synchronous adapter over the page's own URL, one parameter per key, so a value is a shareable link. Writes go through `history.replaceState` and add no history entry; back and forward are observed through `popstate`, or `hashchange` with `{ hash: true }`, which keeps the parameters in the fragment.
- The adapter declares `keyspace: { namespace: "hidden" }`, so a link reads `?note=hello`; `namespace: "visible"` keeps the store's keys apart from other parameters. Parameters it did not write are left as they are.
- `format` replaces JSON so a string is not quoted in the address bar. Meant as a named storage with a schema and fallback on every key, because a link carries no migration version and is untrusted input.
- `sharing: "cross-tab"` announces every write to the other tabs on the same path over a `BroadcastChannel` and writes their changes into this tab's own URL, so the address bars converge. `"single-tab"` is the default, because a URL is one tab's by design.
- Requires `@priemskiyyy/silo` 0.1.

## @priemskiyyy/silo-chrome-storage 0.1.0 - 2026-09-18

- First release. An asynchronous adapter over one `chrome.storage` area, handed over so the same adapter serves `local`, `sync` and `session`, and Firefox's `browser.storage` fits too. Values pass through untouched, serialized by the platform.
- `observe` subscribes to the area's `onChanged`, one report per key; the adapter's own writes echo through it, which the core tolerates. A `sync` quota or rate refusal reaches the value's status.
- Requires `@priemskiyyy/silo` 0.1.

## @priemskiyyy/silo-mmkv 0.1.0 - 2026-09-18

- First release. A synchronous adapter over one `react-native-mmkv` instance the application constructs, so the id, the encryption key and the path stay with `new MMKV({ ... })` and the package imports nothing native. JSON text with `format` to replace it.
- `observe` subscribes to `addOnValueChangedListener` and reads the value back, because MMKV reports the key alone. `keys` lists the instance.
- Requires `@priemskiyyy/silo` 0.1.

## @priemskiyyy/silo-async-storage 0.1.0 - 2026-09-18

- First release. An asynchronous adapter over `@react-native-async-storage/async-storage`, handed over as the module's default export and typed by the four methods it calls. JSON text with `format` to replace it, `keys` from `getAllKeys`, and no `observe`, because nothing reports a change made elsewhere.
- Requires `@priemskiyyy/silo` 0.1.

## @priemskiyyy/silo-expo-secure-store 0.1.0 - 2026-09-18

- First release. An asynchronous adapter over Expo SecureStore, the device keychain and keystore, for a token rather than a document. Every physical key reaches the module as unpadded base64url, because SecureStore accepts only `[A-Za-z0-9._-]`. `options` such as `requireAuthentication` are forwarded to every call.
- SecureStore cannot list what it holds, so there is no `keys` and a migration cannot enumerate this storage; `copy`, `move` and `rename` still work on keys a migration names. Nothing is observed.
- Requires `@priemskiyyy/silo` 0.1.

## @priemskiyyy/silo-react-native-keychain 0.1.0 - 2026-09-18

- First release. An asynchronous adapter over `react-native-keychain` for a bare React Native application, one keychain entry per key. Every key becomes the service `${prefix}${base64url key}`, `silo.` by default, with the plain key as the entry's username; `keys` lists the services under the prefix. A refused write, which the module answers with `false`, becomes a write error on the value's status.
- Requires `@priemskiyyy/silo` 0.1.

## @priemskiyyy/silo-capacitor-preferences 0.1.0 - 2026-09-18

- First release. An asynchronous adapter over Capacitor Preferences, `UserDefaults` on iOS, `SharedPreferences` on Android and `localStorage` on the web, for small values that survive a restart. JSON text with `format` to replace it, `keys` from the plugin, no `observe`. A group is configured once on the plugin before the store is constructed.
- Requires `@priemskiyyy/silo` 0.1.

## @priemskiyyy/silo-icloud 0.1.0 - 2026-09-18

- First release, experimental. An asynchronous adapter over the iCloud key-value store through `react-native-cloud-store`, following the Apple ID across devices. `available` is where an application that also ships on Android answers `Platform.OS === "ios"` and lets the next candidate take over.
- `observe` subscribes to the platform's remote change notification, sent only for changes received from other devices: named keys are read back and reported, a change that names none reports `{ key: null }`. The application calls `kvSync()` itself; the adapter never does.
- Requires `@priemskiyyy/silo` 0.1.

## @priemskiyyy/silo-json-file 0.1.0 - 2026-09-18

- First release. A synchronous adapter over one JSON file for a Node command line tool, a script or Electron's main process. The file is loaded once on first use and rewritten whole on every write through a sibling temporary file renamed into place, so a crash mid-write leaves the previous file intact. One process at a time, and no `observe`.
- Requires `@priemskiyyy/silo` 0.1.

## @priemskiyyy/silo-sqlite 0.1.0 - 2026-09-18

- First release. A synchronous adapter over one key-value table in a SQLite connection the application opens, so `node:sqlite`, `better-sqlite3` and `bun:sqlite` all fit. The table, `silo` unless `table` says otherwise, is created on first use and the four statements are prepared once. JSON text with `format` to replace it, `keys` from the table, no `observe`.
- Requires `@priemskiyyy/silo` 0.1.

## @priemskiyyy/silo-electron-store 0.1.0 - 2026-09-18

- First release. A synchronous adapter over one `electron-store` or `conf` instance the application constructs in the main process. Every key reaches the file percent encoded, because the library reads a `.` as a path into nested objects; `keys` decodes them back.
- `observe` subscribes to `onDidAnyChange` and reports one change per key whose JSON differs; changes from another process arrive when the store was constructed with `watch: true`.
- Requires `@priemskiyyy/silo` 0.1.

## @priemskiyyy/silo-tauri-store 0.1.0 - 2026-09-18

- First release. An asynchronous adapter over a Tauri store the application loads with `Store.load` or a `LazyStore`; autosave and `save()` stay the application's. Values pass through as the plugin's JSON. `observe` subscribes to `onChange`, which also reports the adapter's own writes, and `keys` lists the store.
- Requires `@priemskiyyy/silo` 0.1.

## @priemskiyyy/silo-unstorage 0.1.0 - 2026-09-18

- First release. An asynchronous adapter over any unstorage driver through the `Storage` the application created. Keys are percent encoded so they survive unstorage's normalization, values are JSON encoded so a stored `"42"` does not come back as a number, and a `null` answer asks `hasItem` whether the key exists. No `observe`.
- Requires `@priemskiyyy/silo` 0.1.

## @priemskiyyy/silo-redis 0.1.0 - 2026-09-18

- First release. An asynchronous adapter over a Redis client the application connected, typed by the four methods it calls so `ioredis`, `redis` and `@upstash/redis` fit. `keys()` runs `KEYS` with `match`, which should be the store's namespace such as `silo:*`. No Redis TTL is set: expiry is the core's and is applied on the read that finds a value stale. No `observe`.
- Requires `@priemskiyyy/silo` 0.1.

## @priemskiyyy/silo-http 0.1.0 - 2026-09-18

- First release. An asynchronous adapter over a REST key-value resource reached with `fetch`: `GET` answers the value or 404, `PUT` stores the JSON body, `DELETE` removes it, and `GET` on the base URL lists the keys, with `keys: false` for a server that has none. `headers` may be a function awaited per request, so a token is never stale. `fetch` is read when a request is made, so a server render costs no request and `available()` answers whether one is reachable.
- Requires `@priemskiyyy/silo` 0.1.

## @priemskiyyy/silo-cloudflare-kv 0.1.0 - 2026-09-18

- First release. An asynchronous adapter over a Workers KV namespace binding, eventually consistent across the edge, for per-user settings and feature flags rather than a counter. Values are read as text because only text tells a stored `null` from an absent key; `keys` walks every page of `list`. No `observe`.
- Requires `@priemskiyyy/silo` 0.1.

## @priemskiyyy/silo-cloudflare-durable-objects 0.1.0 - 2026-09-18

- First release. An asynchronous adapter over a Durable Object's own `ctx.storage`, strongly consistent and living with the object, so a store is constructed per object instance. Values pass through as structured clones. `keys` lists the storage, and nothing reports a change from outside the object.
- Requires `@priemskiyyy/silo` 0.1.

## @priemskiyyy/silo-simulcast 0.1.0 - 2026-09-18

- First release. A bridge that gives any storage adapter live change notifications from a simulcast channel: reads, writes, `keys`, `native` and the mode are the wrapped adapter's, and `observe` delivers every `{ key, value }` published on the channel, so a value written on one device updates on every other. `publish`, for a setup where the server does not announce writes itself, runs after each write lands and never before.
- Requires `@priemskiyyy/silo` 0.1 and a `@priemskiyyy/simulcast` channel, typed structurally as `{ subscribe }`.

## @priemskiyyy/silo-devtools 0.1.0 - 2026-09-18

- First release. An inspector over `silo.diagnostics`, rendered in a shadow root by a framework-independent `SiloDevtools` class with `mount`, `unmount`, `setSilo` and `setMaxEvents`, and a React wrapper at `@priemskiyyy/silo-devtools/react` that reads the provider's store.
- The panel docks to the bottom or the right edge, resizes by drag or keyboard, and persists its open state, dock and size in `localStorage`. The sidebar lists every storage with the adapter that won and its mode, and under each the records the application reached; selecting one filters the timeline and opens its detail, with a JSON field to set a value and a button to remove it, both through the store's own API.
- Recording starts when the panel mounts and continues while collapsed. Values stay hidden until "Show values" is ticked, and `token`, `authorization`, `password`, `secret` and `cookie` keys are redacted always. The devtools never read a value the application has not reached.
- Requires `@priemskiyyy/silo` 0.1.

## @priemskiyyy/silo-react 0.1.0 - 2026-09-17

- First release. `SiloProvider` publishes one store and, through its `scope` prop, the scope every value hook below it reads under. `useValue`, `useValueStatus`, `useSiloStatus`, `useSilo`, `useScope` and `useNativeStorage`, all typed by the `Register` declaration-merging target, with `storage.key` paths reaching every storage.
- Value setters accept updater callbacks against the latest core snapshot; wrap function values in an updater. Every read hook takes an `onChange` callback that runs on later changes with the latest callback.
- Values are read through `useSyncExternalStore` against the stored reference, so a render neither tears nor loops. On the server every value reads its schema fallback, `useValueStatus` reads `hydrating`, and `useSiloStatus` reads `migrating`, so either is safe to gate on.
- Requires `@priemskiyyy/silo` 0.1.

## @priemskiyyy/silo-vue 0.1.0 - 2026-09-17

- Initial Vue binding: `SiloProvider`, reactive values, value and migration status, scopes, and native storage access.
- Typed through `Register`, with reactive key and provider changes, automatic subscription cleanup, and server-rendering coverage.
- Requires `@priemskiyyy/silo` 0.1.

## @priemskiyyy/silo-solid 0.1.0 - 2026-09-17

- Value setters accept updater callbacks against the latest core snapshot. Wrap function values in an updater.

- Initial Solid binding: `SiloProvider`, reactive values, value and migration status, scopes, and native storage access.
- Typed through `Register`, with reactive key and provider changes, automatic subscription cleanup, and server-rendering coverage.
- Requires `@priemskiyyy/silo` 0.1.

## @priemskiyyy/silo-svelte 0.1.0 - 2026-09-17

- Initial Svelte binding: `SiloProvider`, reactive values, value and migration status, scopes, and native storage access.
- Typed through `Register`, with reactive key and provider changes, automatic subscription cleanup, and server-rendering coverage.
- Requires `@priemskiyyy/silo` 0.1.
