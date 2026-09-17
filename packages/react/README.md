<p align="center">
  <img src="https://raw.githubusercontent.com/priemskiyyy/silo/main/docs/public/logo.png" width="88" height="88" alt="Silo" />
</p>

# @priemskiyyy/silo-react

React hooks for [Silo](https://priemskiyyy.github.io/silo/). The provider
publishes one store; the hooks read stored values, observe their status, reach
the provider's scope and the adapters' native handles. The binding holds no
persistence logic: it is `useSyncExternalStore` over the store's observables.
React 19.2 or newer.

```sh
pnpm add @priemskiyyy/silo @priemskiyyy/silo-react @priemskiyyy/silo-local-storage @priemskiyyy/silo-memory
```

```tsx
import type * as React from "react";
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
});

// One augmentation, next to the store, types every hook.
declare module "@priemskiyyy/silo-react" {
  interface Register {
    silo: typeof silo;
  }
}

const ThemeToggle: React.FunctionComponent = () => {
  const [theme, setTheme] = useValue("theme");

  return (
    <button
      onClick={() =>
        setTheme((previous) => (previous === "dark" ? "light" : "dark"))
      }
    >
      {theme}
    </button>
  );
};

export const Application: React.FunctionComponent = () => (
  <SiloProvider silo={silo}>
    <ThemeToggle />
  </SiloProvider>
);
```

With `Register` augmented, keys are narrowed to the schema, an unknown key is a
compile error, a key with a `fallback` reads without `| undefined`, and the
native handles carry their adapters' types. Without it the hooks still work,
with `string` keys and `unknown` values.

| Export                           | Purpose                                                                                  |
| -------------------------------- | ---------------------------------------------------------------------------------------- |
| `SiloProvider`                   | Publishes a store, and optionally a `scope` segment the value hooks below read under.    |
| `useValue(key, onChange?)`       | Read one value and rerender on change; returns `[value, setValue]` with updater support. |
| `useValueStatus(key, onChange?)` | Observe one value's `hydrating`, `ready` or `error` progress without reading the value.  |
| `useSiloStatus(onChange?)`       | Observe the store: `migrating`, `ready`, or the migration that failed.                   |
| `useScope()`                     | The provider's scope: `value`, `scope`, `clear` and `release` under its prefix.          |
| `useSilo()`                      | The store itself, for `flush`, `ready`, `native` and `diagnostics`.                      |
| `useNativeStorage()`             | The native handles by storage name, such as `Storage \| null` for `localStorage()`.      |

Keys of the default storage are bare; keys of any other storage read as
`storage.key`. A synchronous adapter can load the persisted value during the
first render when migrations are ready. An asynchronous adapter starts with
the fallback and notifies React when hydration completes. `useValueStatus`
acquires the key and starts hydration too. Server-rendered applications must
keep their initial client markup consistent with the server; see
[server rendering](https://priemskiyyy.github.io/silo/server-rendering).
The provider does not write or dispose the store. The application owns its lifetime.

The devtools ship a wrapper for this provider:
`import { SiloDevtools } from "@priemskiyyy/silo-devtools/react"`.

## Guides

- [React hooks](https://priemskiyyy.github.io/silo/react)
- [Server rendering](https://priemskiyyy.github.io/silo/server-rendering)
- [Scopes](https://priemskiyyy.github.io/silo/scopes)
- [Errors and recovery](https://priemskiyyy.github.io/silo/errors-and-recovery)

## License

[MIT](LICENSE)
