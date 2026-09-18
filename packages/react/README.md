<p align="center">
  <img src="https://raw.githubusercontent.com/priemskiyyy/silo/main/docs/public/logo.png" width="88" height="88" alt="Silo" />
</p>

# @priemskiyyy/silo-react

React hooks for [Silo](https://priemskiyyy.github.io/silo/). Read typed values,
update them with React-style setters, and observe loading or storage errors.
Requires React 19.2 or newer.

```sh
pnpm add @priemskiyyy/silo @priemskiyyy/silo-react @priemskiyyy/silo-local-storage zod
```

```tsx
import { Silo, value } from "@priemskiyyy/silo";
import { localStorage } from "@priemskiyyy/silo-local-storage";
import { z } from "zod";

const ThemeSchema = z.enum(["light", "dark"]);
import { useValue, useValueStatus } from "@priemskiyyy/silo-react";

const silo = new Silo({
  storages: {
    default: {
      adapters: [localStorage()],
      schema: { theme: value({ schema: ThemeSchema, fallback: "light" }) },
    },
  },
});

export const ThemeToggle = () => {
  const handle = silo.value("theme");
  const [theme, setTheme] = useValue(handle);
  const status = useValueStatus(handle);

  if (status.state === "hydrating") {
    return <button disabled>Loading theme…</button>;
  }

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
```

Handle calls infer their value type without a provider. For key-based calls such
as `useValue("theme")`, use `SiloProvider` and optionally augment `Register` with
`{ silo: typeof silo }`. The [React guide](https://priemskiyyy.github.io/silo/react)
shows that setup.

The module-level store above is for a browser application. Server-rendered apps
need a store per request and matching server/client markup; see
[server rendering](https://priemskiyyy.github.io/silo/server-rendering).

| Export                                   | Purpose                                                                                  |
| ---------------------------------------- | ---------------------------------------------------------------------------------------- |
| `SiloProvider`                           | Publishes a store, and optionally a `scope` segment the value hooks below read under.    |
| `useValue(keyOrHandle, onChange?)`       | Read one value and rerender on change; returns `[value, setValue]` with updater support. |
| `useValueStatus(keyOrHandle, onChange?)` | Observe one value's `hydrating`, `ready` or `error` progress without reading the value.  |
| `useSiloStatus(onChange?)`               | Observe the store: `migrating`, `ready`, or the migration that failed.                   |
| `useScope()`                             | The provider's scope: `value`, `scope`, `clear` and `release` under its prefix.          |
| `useSilo()`                              | The store itself, for `flush`, `ready`, `native` and `diagnostics`.                      |
| `useNativeStorage()`                     | The native handles by storage name, such as `Storage \| null` for `localStorage()`.      |

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

## Explicit handles

`useValue(handle)` and `useValueStatus(handle)` accept scoped values directly,
without a provider or `Register`. Mix root, workspace, and user handles in one
component; changing a handle retargets its subscription and setter. Wait for
required IDs before mounting the consumer; an undefined provider scope selects
root storage.

See the [binding guide](https://priemskiyyy.github.io/silo/react#explicit-value-handles).

## License

[MIT](LICENSE)
