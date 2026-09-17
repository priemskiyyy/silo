<p align="center">
  <img src="docs/public/logo.png" width="88" height="88" alt="Silo" />
</p>

# Silo

**Typed, reactive persistence for TypeScript.**

Declare stored values with types, fallbacks and optional validation. Silo
provides reactive snapshots over 23 storage adapters, orders writes, and runs
migrations before hydration. Bindings connect the same values to React, Vue,
Solid and Svelte.

[Documentation](https://priemskiyyy.github.io/silo/) ·
[Get started](https://priemskiyyy.github.io/silo/getting-started) ·
[Live demo](https://priemskiyyy.github.io/silo/demo/) ·
[Adapters](https://priemskiyyy.github.io/silo/adapters) ·
[Devtools](https://priemskiyyy.github.io/silo/devtools)

## Quick start

```sh
pnpm add @priemskiyyy/silo @priemskiyyy/silo-react @priemskiyyy/silo-local-storage @priemskiyyy/silo-memory
```

```tsx
import { Silo, value } from "@priemskiyyy/silo";
import { localStorage } from "@priemskiyyy/silo-local-storage";
import { memory } from "@priemskiyyy/silo-memory";
import { SiloProvider, useValue } from "@priemskiyyy/silo-react";

type Theme = "light" | "dark";

const silo = new Silo({
  storages: {
    default: {
      adapters: [localStorage(), memory()],
      schema: { theme: value<Theme>({ fallback: "light" }) },
    },
  },
  // Version 2 renames the key an older release wrote. Each step is
  // checkpointed as it lands, so a failure never runs it twice.
  migrations: {
    2: (store) => store.rename("legacyTheme", "theme"),
  },
});

declare module "@priemskiyyy/silo-react" {
  interface Register {
    silo: typeof silo;
  }
}

const ThemeToggle = () => {
  const [theme, setTheme] = useValue("theme");

  return (
    <button onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
      {theme}
    </button>
  );
};

export const App = () => (
  <SiloProvider silo={silo}>
    <ThemeToggle />
  </SiloProvider>
);
```

`theme` is a `Theme`, never `undefined`, because the key declares a fallback.
The first candidate whose `available()` probe passes wins, so the same store
runs on a server or in a browser that blocks site data, on `memory()`. Swap
`localStorage()` for `indexedDb()`, `mmkv({ storage })` or `redis({ client })`
and the component does not change. `rename`, `move` and `copy` on the
migration store cover most schema changes, across storages too. The full
[getting started guide](https://priemskiyyy.github.io/silo/getting-started)
adds a second storage, a scope per user and an expiring key.

## A write made during hydration wins

An asynchronous storage read can finish after the user edits a value. Silo
invalidates that older read when a local write is accepted, so its result
cannot overwrite the edit.

```text
t0  theme is acquired       hydration starts; snapshot is the fallback
t1  theme.set("dark")      write starts; snapshot becomes "dark"
t2  the older read settles  its result is discarded
t3  await theme.flush()     resolves when the write reaches the adapter
```

## Why Silo

- **Reads never await.** `get()` returns the current snapshot on both adapter
  modes, by reference. Decoding runs once per inbound value, so the identity is
  stable and `useSyncExternalStore` consumers do not loop.
- **A fallback is carried in the type.** A key declaring one reads as its value
  type with no `| undefined`. A key without one keeps it.
- **Storages, not one adapter.** A store runs over named storages, each with
  its own schema, its own candidate list and its own namespace. `theme` and
  `secure.token` are two typed keys of one store, and a migration can `move` a
  key between them.
- **Writes are ordered.** One write in flight and one latest-wins pending slot.
  `flush()` captures the current mutation and resolves when it is durable, so a
  coalesced-away write does not hang the barrier.
- **Adapter failures are observable.** A failed write updates the value's
  status and rejects `flush()`. Encoding and updater errors still throw to
  the caller. A `decode` that
  fails reports `{ state: "error", error: { phase: "hydrate" } }` and leaves the
  stored raw value where it is, so the application can inspect or migrate it.
- **Observing does not create demand.** Reaching a value with `silo.value(key)`
  starts its hydration. `silo.status`, `flush()` and `silo.diagnostics` read
  nothing, which is what lets the devtools inspect a store without reading it.
- **The backend stays reachable.** `silo.native.default` carries the adapter's
  own handle at its exact type, so nothing is hidden behind the abstraction.
- **No runtime dependencies.** No package in this repository declares one. An
  adapter that wraps an SDK is handed the SDK's instance.

## What Silo normalizes

| Normalized                                                             | Left to the storage medium                    |
| ---------------------------------------------------------------------- | --------------------------------------------- |
| A typed schema: fallbacks, codecs, Standard Schema validation          | Durability, quota and eviction                |
| Synchronous reads on every backend, with a stable snapshot identity    | Which values survive a round trip             |
| Candidate adapters: the first available wins, memory is the floor      | Encryption, permissions and private browsing  |
| Physical keys: a namespace per store or storage, scopes, visibility    | Transaction and locking semantics             |
| Ordered, coalesced writes and `flush()` as the durability barrier      | Whether a change made elsewhere is observable |
| Expiry for the keys that declare it                                    | How much space the origin or the device gets  |
| Migrations across storages with `copy`, `move` and `rename`            | Storage inspection and clearing by the user   |
| Changes made outside the store, applied while nothing local is pending |                                               |
| Adapter failures reported through status and flush                     |                                               |
| Diagnostics and devtools                                               |                                               |

Adapters own serialization in both directions. That is why an exotic value
survives on one backend and not another, and why it is a row in a table rather
than a promise Silo makes.

## Frameworks and adapters

| Package                                           | Purpose                                                                 |
| ------------------------------------------------- | ----------------------------------------------------------------------- |
| [`@priemskiyyy/silo`](packages/core)              | Runtime, adapter contract, text adapter helper, mock, conformance suite |
| [`@priemskiyyy/silo-react`](packages/react)       | React and React Native bindings                                         |
| [`@priemskiyyy/silo-vue`](packages/vue)           | Vue composables                                                         |
| [`@priemskiyyy/silo-solid`](packages/solid)       | Solid primitives                                                        |
| [`@priemskiyyy/silo-svelte`](packages/svelte)     | Svelte utilities                                                        |
| [`@priemskiyyy/silo-devtools`](packages/devtools) | Browser inspector and React wrapper                                     |

| Backend                    | Package                                                                                        | Mode    |
| -------------------------- | ---------------------------------------------------------------------------------------------- | ------- |
| In-process `Map`           | [`@priemskiyyy/silo-memory`](packages/adapters/memory)                                         | sync    |
| `localStorage`             | [`@priemskiyyy/silo-local-storage`](packages/adapters/local-storage)                           | sync    |
| `sessionStorage`           | [`@priemskiyyy/silo-session-storage`](packages/adapters/session-storage)                       | sync    |
| IndexedDB                  | [`@priemskiyyy/silo-indexeddb`](packages/adapters/indexeddb)                                   | async   |
| `document.cookie`          | [`@priemskiyyy/silo-cookie`](packages/adapters/cookie)                                         | sync    |
| URL search params          | [`@priemskiyyy/silo-search-params`](packages/adapters/search-params)                           | sync    |
| `chrome.storage`           | [`@priemskiyyy/silo-chrome-storage`](packages/adapters/chrome-storage)                         | async   |
| MMKV                       | [`@priemskiyyy/silo-mmkv`](packages/adapters/mmkv)                                             | sync    |
| AsyncStorage               | [`@priemskiyyy/silo-async-storage`](packages/adapters/async-storage)                           | async   |
| Expo SecureStore           | [`@priemskiyyy/silo-expo-secure-store`](packages/adapters/expo-secure-store)                   | async   |
| react-native-keychain      | [`@priemskiyyy/silo-react-native-keychain`](packages/adapters/react-native-keychain)           | async   |
| Capacitor Preferences      | [`@priemskiyyy/silo-capacitor-preferences`](packages/adapters/capacitor-preferences)           | async   |
| iCloud key-value           | [`@priemskiyyy/silo-icloud`](packages/adapters/icloud)                                         | async   |
| JSON file                  | [`@priemskiyyy/silo-json-file`](packages/adapters/json-file)                                   | sync    |
| SQLite                     | [`@priemskiyyy/silo-sqlite`](packages/adapters/sqlite)                                         | sync    |
| electron-store             | [`@priemskiyyy/silo-electron-store`](packages/adapters/electron-store)                         | sync    |
| Tauri store                | [`@priemskiyyy/silo-tauri-store`](packages/adapters/tauri-store)                               | async   |
| Redis                      | [`@priemskiyyy/silo-redis`](packages/adapters/redis)                                           | async   |
| unstorage                  | [`@priemskiyyy/silo-unstorage`](packages/adapters/unstorage)                                   | async   |
| Cloudflare Workers KV      | [`@priemskiyyy/silo-cloudflare-kv`](packages/adapters/cloudflare-kv)                           | async   |
| Cloudflare Durable Objects | [`@priemskiyyy/silo-cloudflare-durable-objects`](packages/adapters/cloudflare-durable-objects) | async   |
| REST key-value over fetch  | [`@priemskiyyy/silo-http`](packages/adapters/http)                                             | async   |
| Simulcast bridge           | [`@priemskiyyy/silo-simulcast`](packages/adapters/simulcast)                                   | wrapped |

The [adapter comparison](https://priemskiyyy.github.io/silo/adapters) shows
which values each backend carries, which ones observe changes made elsewhere,
and what `silo.native` exposes. `localStorage` and `sessionStorage` are exported
under the names of the DOM globals they wrap, which shadows them inside the
importing module: `import { localStorage as localStorageAdapter }` if that
module needs both.

## Live demo and devtools

Open the [hosted Fieldbook demo](https://priemskiyyy.github.io/silo/demo/):
one store over eight storages, a REST server that lives in the page, and a Lab
that breaks them on purpose. Then open the Silo Devtools launcher and watch the
records, writes, refusals and migrations that produced what you see. No backend,
account, or credentials.

The inspector is built on `silo.diagnostics`, renders in a shadow root, works
without a framework, and never reads a value the application has not reached.
[Devtools guide](https://priemskiyyy.github.io/silo/devtools).

## Custom adapters

If Silo does not ship an adapter for your storage, write one with
`createStorageAdapter`, or with `createTextStorageAdapter` when the backend
holds text, and run `testStorageAdapter` from `@priemskiyyy/silo/testing`
against it. `@priemskiyyy/silo/mock` exports `createMockAdapter`, which emits
echoes, duplicates, stale values and post-dispose changes on demand. The
[adapter guide](https://priemskiyyy.github.io/silo/writing-an-adapter) covers
the contract, package layout and tests.

## Development

Use Node 22.18 or newer and the pnpm version declared in `package.json`.

```sh
pnpm install --frozen-lockfile
pnpm check
pnpm build:docs
```

`pnpm check` builds every package and the example, checks types, lint and
formatting, and runs the unit and memory suites. `pnpm check:release` adds the
documentation build, the browser suite, the packed-consumer verification and
the release metadata check. See [CONTRIBUTING.md](CONTRIBUTING.md), the
[architecture and invariants](https://priemskiyyy.github.io/silo/internals/architecture),
and [RELEASING.md](RELEASING.md).

## License

[MIT](LICENSE)
