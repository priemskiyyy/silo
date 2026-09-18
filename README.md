<p align="center">
  <img src="docs/public/logo.png" width="88" height="88" alt="Silo" />
</p>

# Silo

**Typed, reactive persistence for TypeScript.**

Store preferences, drafts, and other application state in localStorage,
IndexedDB, a device store, or a server backend. Read the current value
synchronously, subscribe to changes, and check whether writes succeeded.
React, Vue, Solid, and Svelte bindings use the same values.

[Documentation](https://priemskiyyy.github.io/silo/) ·
[Get started](https://priemskiyyy.github.io/silo/getting-started) ·
[Live demo](https://priemskiyyy.github.io/silo/demo/) ·
[Recipes](https://priemskiyyy.github.io/silo/recipes)

## Store a value

For a browser application:

```sh
pnpm add @priemskiyyy/silo @priemskiyyy/silo-local-storage zod
```

```ts
// silo.ts
import { Silo, value } from "@priemskiyyy/silo";
import { localStorage } from "@priemskiyyy/silo-local-storage";
import { z } from "zod";

const ThemeSchema = z.enum(["light", "dark"]);

export const silo = new Silo({
  storages: {
    default: {
      adapters: [localStorage()],
      schema: { theme: value({ schema: ThemeSchema, fallback: "light" }) },
    },
  },
});

const theme = silo.value("theme");
theme.get(); // stored preference, or "light" when absent

theme.set("dark");
await theme.flush(); // rejects if storage refused the write
```

`theme` gets its `"light" | "dark"` type and storage validation from `ThemeSchema`.
The fallback is not written to storage.
With IndexedDB or another asynchronous adapter, `get()` initially returns the
fallback and subscribers are notified when the stored value arrives.

## Use it in React

```sh
pnpm add @priemskiyyy/silo-react
```

```tsx
import { useValue } from "@priemskiyyy/silo-react";
import { silo } from "./silo";

export const ThemeToggle = () => {
  const [theme, setTheme] = useValue(silo.value("theme"));

  return (
    <button
      onClick={() =>
        setTheme((previous) => (previous === "dark" ? "light" : "dark"))
      }
    >
      Theme: {theme}
    </button>
  );
};
```

Passing a handle infers its type without a provider or module augmentation.
For key-based hooks such as `useValue("theme")`, use a provider and optionally
register the store's type. See [React](https://priemskiyyy.github.io/silo/react),
[Vue](https://priemskiyyy.github.io/silo/vue),
[Solid](https://priemskiyyy.github.io/silo/solid), or
[Svelte](https://priemskiyyy.github.io/silo/svelte).

**Rendering on a server?** Create a store per request and render a consistent
placeholder for browser-only values. The
[getting started guide](https://priemskiyyy.github.io/silo/getting-started)
shows the React status check; [server rendering](https://priemskiyyy.github.io/silo/server-rendering)
covers request isolation and client setup.

## Choose storage for each value

Each named storage has its own adapter and schema:

```ts
import { sessionStorage } from "@priemskiyyy/silo-session-storage";

const app = new Silo({
  storages: {
    default: {
      adapters: [localStorage()],
      schema: { theme: value({ schema: ThemeSchema, fallback: "light" }) },
    },
    session: {
      adapters: [sessionStorage()],
      schema: { draft: value({ fallback: "" }) },
    },
  },
});

app.value("theme").set("dark");
app.value("session.draft").set("Hello");
```

Install `@priemskiyyy/silo-session-storage` for this example. Storage names route
API calls; they are not part of physical keys. Give storages distinct namespaces
when they share a backend. [Storages and namespaces](https://priemskiyyy.github.io/silo/storages)
shows the key layout and how to preserve existing keys.

## Update older data

Add versioned steps to the same store's options:

```ts
migrations: {
  1: (store) => store.rename("legacyTheme", "theme"),
  2: (store) => store.move("draft", { to: "session" }),
},
```

Silo runs steps in order before loading values and saves a checkpoint after each
step succeeds. A failed checkpoint write, interruption, or concurrent startup can
repeat a step. Write migrations that tolerate reruns; they are not transactions.
See [migrations](https://priemskiyyy.github.io/silo/migrations).

## More you can do

| Task                                                     | API and example                                                                                             |
| -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Separate workspace and user preferences                  | [`scope()` and explicit handles](https://priemskiyyy.github.io/silo/recipes#workspace-and-user-preferences) |
| Validate data written by older versions or other clients | [`value({ schema })` and codecs](https://priemskiyyy.github.io/silo/schema-and-codecs)                      |
| Preserve an existing physical key format                 | [Storage `keys: { encode, decode }`](https://priemskiyyy.github.io/silo/storages#existing-storage-keys)     |
| Show whether a draft was saved and retry a failed write  | [`status` and `flush()`](https://priemskiyyy.github.io/silo/recipes#save-a-draft-and-retry)                 |
| Keep filters in a shareable URL                          | [`searchParams()`](https://priemskiyyy.github.io/silo/recipes#shareable-state-in-the-url)                   |
| Expire a dismissed banner or cached value                | [`expires: { in }` or `{ at }`](https://priemskiyyy.github.io/silo/ttl)                                     |
| Free records after leaving a workspace                   | [`scope.release()`](https://priemskiyyy.github.io/silo/scopes#release)                                      |
| Inspect values, errors, and migration events             | [Devtools](https://priemskiyyy.github.io/silo/devtools)                                                     |

## Behavior to know

- A local edit supersedes an older hydration read. That read cannot overwrite
  the edit when it finishes.
- Writes to each value are ordered. While one is pending, later edits replace
  the queued value. `flush()` waits for the accepted writes or their replacements.
- Adapter errors appear on `status`; failed writes also reject `flush()`.
  Encoding and updater errors throw to the caller.
- `[localStorage(), memory()]` selects memory if the availability probe fails.
  Selection happens once. An asynchronous open failure or a later write failure
  does not switch adapters. See [initialization](https://priemskiyyy.github.io/silo/adapters#candidate-lists-and-available).
- Backend limits still apply: supported value types, quotas, eviction,
  permissions, and durability depend on the adapter.

## Runnable examples

- [Browser Fieldbook](examples/react-web): scoped notebooks, eight storage backends, recovery controls, and devtools.
- [Expo Fieldbook](examples/expo): device drafts, global and user preferences, and SecureStore.

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
and what `silo.native` exposes. The [verification matrix](https://priemskiyyy.github.io/silo/verification)
shows which adapters have real backend tests and which use fakes. `localStorage` and `sessionStorage` are exported
under the names of the DOM globals they wrap, which shadows them inside the
importing module: `import { localStorage as localStorageAdapter }` if that
module needs both.

## Live demo and devtools

Open the [hosted Fieldbook demo](https://priemskiyyy.github.io/silo/demo/):
a React notebook using eight storages. Its Lab simulates slow reads, failed
writes, and unavailable storage. Open Devtools to inspect the corresponding
records and events. The demo runs locally in the browser without an account.

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
