---
description: "Solid bindings for Silo: typed values, reactive scopes, status, and native storage."
---

# Solid

Requires Solid 1.9 or newer in the Solid 1 line.

```sh
pnpm add @priemskiyyy/silo @priemskiyyy/silo-solid @priemskiyyy/silo-local-storage
```

## Register your store

```ts
// storage.ts
import { Silo, value } from "@priemskiyyy/silo";
import { localStorage } from "@priemskiyyy/silo-local-storage";

export const silo = new Silo({
  storages: {
    default: {
      adapters: [localStorage()],
      schema: { theme: value<"light" | "dark">({ fallback: "light" }) },
    },
  },
});

declare module "@priemskiyyy/silo-solid" {
  interface Register {
    silo: typeof silo;
  }
}
```

Registration infers valid keys, setter inputs, and native handles. Values without
a fallback retain `undefined` in their read type.

## Read and write

```tsx
import {
  SiloProvider,
  useValue,
  useValueStatus,
} from "@priemskiyyy/silo-solid";
import { silo } from "./storage";

const Settings = () => {
  const [theme, setTheme] = useValue("theme");
  const status = useValueStatus("theme");

  return (
    <>
      <button
        onClick={() =>
          setTheme((previous) => (previous === "light" ? "dark" : "light"))
        }
      >
        {theme()}
      </button>
      <p>{status().state}</p>
    </>
  );
};

export const Application = () => (
  <SiloProvider silo={silo} scope="account">
    <Settings />
  </SiloProvider>
);
```

`useValue` returns an accessor and a setter. Other primitives return accessors.
Pass a getter for reactive keys, such as `useValue(() => props.preferenceKey)`.
The setter follows the current key, scope, and provider; keep it without
recreating it when those inputs change.

The setter accepts a value or an updater, such as
`setCount((previous) => previous + 1)`, and returns the resolved value. Updaters
run synchronously against the latest core snapshot without tracking reactive
reads. Successive updates compose, including while a write is pending. During
hydration the previous value may be the fallback; a local update supersedes the
pending read. Separate tabs or Silo instances do not share an atomic update.

Wrap function values: `setCallback(() => callback)`. Pass `undefined`, or return
it from an updater, to remove an optional value. An updater that throws leaves
the value unchanged and passes its error to the caller.

## Shared API

| API                              | Result                                      |
| -------------------------------- | ------------------------------------------- |
| `useValue(key, onChange?)`       | Stored snapshot and framework-native writes |
| `useValueStatus(key, onChange?)` | Hydration and write status                  |
| `useSiloStatus(onChange?)`       | Migration status                            |
| `useSilo()`                      | Current provider's Silo                     |
| `useScope()`                     | Current provider's root or named scope      |
| `useNativeStorage()`             | Native handles by storage name              |

`onChange` runs for subsequent updates, including external changes, rather than
for the initial snapshot. Changing the key or provider moves subscriptions to
the new value. The provider follows its `silo` and `scope` props and releases
subscriptions on teardown; the application remains responsible for `silo.dispose()`.

Status subscriptions do not read or subscribe to value snapshots. Acquiring a
key still follows [the core's hydration rules](hydration-and-flush.md).

## Server rendering

The binding renders the current snapshot without attaching value subscriptions.
A cold browser adapter returns the schema fallback; an asynchronous adapter
keeps that fallback until its read settles. Snapshots retain their original
object identity and are never deeply proxied by the binding.

Create one Silo per server request. A synchronous browser adapter can return a
value different from the server's fallback during hydration. Render
storage-dependent content after mount when that difference would change server
markup. Status reads here reflect the core's current status; they are not a
server/client hydration boundary. See [server rendering](server-rendering.md)
for adapter behavior and request isolation.
