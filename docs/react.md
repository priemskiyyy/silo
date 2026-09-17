---
description: "React hooks for typed persistence: SiloProvider, useValue, useValueStatus and useSiloStatus over localStorage, IndexedDB or any Silo adapter, typed with Register."
---

# React hooks

```sh
pnpm add @priemskiyyy/silo @priemskiyyy/silo-react
```

The binding holds no persistence logic. It publishes one store through context
and reads its observable values through `useSyncExternalStore`, so a persisted
value renders the way component state does. React 19.2 or newer is required,
because the change callbacks are built on `useEffectEvent`.

Every hook requires a `SiloProvider` above it and throws
`Silo hooks must be used within a SiloProvider.` when there is none.

| Export                                  | Returns                        | Starts hydration | Rerenders on a value change |
| --------------------------------------- | ------------------------------ | ---------------- | --------------------------- |
| [`SiloProvider`](#siloprovider)         | the tree below it              | no               | no                          |
| [`useValue`](#usevalue)                 | `[value, setValue]`            | yes              | yes                         |
| [`useValueStatus`](#usevaluestatus)     | `ValueStatus`                  | yes              | no                          |
| [`useSiloStatus`](#usesilostatus)       | `SiloStatus`                   | no               | no                          |
| [`useScope`](#usescope)                 | the provider's scope           | no               | no                          |
| [`useSilo`](#usesilo)                   | the store                      | no               | no                          |
| [`useNativeStorage`](#usenativestorage) | native handles by storage name | no               | no                          |
| [`Register`](#register)                 | types for all of the above     |                  |                             |

"Starts hydration" is what the core calls demand: reaching a value creates its
record and issues its first read. Observing the store's status, a scope, or a
native handle reads nothing.

## A complete setup

```tsx
import { Silo, value } from "@priemskiyyy/silo";
import { localStorage as localStorageAdapter } from "@priemskiyyy/silo-local-storage";
import { memory } from "@priemskiyyy/silo-memory";
import {
  SiloProvider,
  useValue,
  useValueStatus,
} from "@priemskiyyy/silo-react";
import type { PropsWithChildren } from "react";

type Theme = "light" | "dark";

export const silo = new Silo({
  storages: {
    default: {
      // localStorage when the browser allows it, memory otherwise, so the
      // store constructs in a private window and on the server alike.
      adapters: [localStorageAdapter(), memory()],
      schema: {
        theme: value<Theme>({ fallback: "light" }),
        user: value<{ name: string }>(),
      },
    },
  },
});

// One augmentation, next to the store. Every hook is typed from here on.
declare module "@priemskiyyy/silo-react" {
  interface Register {
    silo: typeof silo;
  }
}

export const Providers = ({ children }: PropsWithChildren) => (
  <SiloProvider silo={silo}>{children}</SiloProvider>
);

export const ThemeToggle = () => {
  // Theme, never Theme | undefined, because the key declares a fallback.
  const [theme, setTheme] = useValue("theme");
  const status = useValueStatus("theme");

  if (status.state === "hydrating") {
    return <button disabled>Theme</button>;
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

export const Greeting = () => {
  // { name: string } | undefined: no fallback was declared.
  const [user] = useValue("user");

  return <p>{user === undefined ? "Welcome" : `Welcome back, ${user.name}`}</p>;
};
```

The store owns its own lifetime. Mounting the provider persists nothing and
unmounting it discards nothing. Whoever constructed the store calls `dispose()`,
which in a browser application is usually nobody, because the store lives as
long as the page.

## SiloProvider

```tsx
import type { PropsWithChildren } from "react";
import type { RegisteredSilo } from "@priemskiyyy/silo-react";

type SiloProviderProps = PropsWithChildren<{
  silo: RegisteredSilo;
  scope?: string | undefined;
}>;
```

| Prop    | Meaning                                                                                                                                                                                         |
| ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `silo`  | The store every hook below reads. Construct it once, at module scope in a browser application, never inside a component, where each render would build a new one.                               |
| `scope` | A segment such as `users:7`. The value hooks below read under that [scope](scopes.md); omitted or `undefined`, they read the root, so a value that is only sometimes known can be passed as is. |

Changing `scope` re-points every value hook under the provider at another
keyspace without remounting them. Providers nest: an inner one with a `scope`
addresses the same store under a prefix while the outer tree keeps reading the
root.

```tsx
<SiloProvider silo={silo}>
  <Preferences />
  <SiloProvider silo={silo} scope={`notebooks:${notebookId}`}>
    <Entries />
  </SiloProvider>
</SiloProvider>
```

See [Server rendering](server-rendering.md) for the one case where a store is
constructed per request rather than once.

## useValue

```ts
import type { Dispatch, SetStateAction } from "react";
import type { RegisteredKey, RegisteredValue } from "@priemskiyyy/silo-react";

useValue<TKey extends RegisteredKey>(
  key: TKey,
  onChange?: (value: RegisteredValue<TKey>) => void | Promise<unknown>,
): [RegisteredValue<TKey>, Dispatch<SetStateAction<RegisteredValue<TKey>>>]
```

Reads one stored value under the provider's scope and rerenders when it
changes, including when another tab changed it. Keys of the default storage are
bare; keys of every other storage are `storage.key`, so `useValue("session.draft")`
reads the `draft` key of the storage named `session`. See
[Storages and namespaces](storages.md).

The value's type is the schema's answer: `TValue` for a key with a `fallback`,
`TValue | undefined` for a key without one. Setting `undefined` on a key without
a fallback is a removal, because `undefined` means absent and nothing else.

The setter accepts a value or an updater, the way `useState` does:

```ts
const [count, setCount] = useValue("count");

setCount((previous) => previous + 1);
```

Updaters run synchronously against the latest core snapshot, so consecutive
calls compose before React rerenders, and an external change that landed in
between is read by the next updater. During hydration that snapshot may still be
the fallback; a local update supersedes the pending read. None of this makes a
read-modify-write atomic across tabs or across stores.

To store a function, wrap it: `setCallback(() => callback)`. An updater must
return the next value, and a throwing updater changes nothing and reaches the
caller. The setter stays stable while the key, the scope and the provider
resolve to the same value handle, so it belongs in dependency arrays as is.

The snapshot is the stored reference, decoded once per inbound value, so its
identity changes only when the value does. That is what keeps a
`useSyncExternalStore` consumer from looping. It also means stored values are
immutable: mutating what you passed to `setValue` corrupts the snapshot with no
notification.

`onChange` runs on changes after registration and never replays the current
value. It may be asynchronous, it always sees the current render's values
without being memoized, and it runs from its own effect-owned listener, so a
throw inside it cannot disturb React's snapshot updates:

```tsx
import { useValue } from "@priemskiyyy/silo-react";

export const ThemeSync = () => {
  const [theme] = useValue("theme", (next) => {
    document.documentElement.dataset["theme"] = next;
  });

  return <span>{theme}</span>;
};
```

What the first render carries depends on the storage's adapter. A synchronous
adapter such as `localStorage()` has the persisted value on the very first
render. An asynchronous one such as `indexedDb()` renders the fallback first and
swaps in the persisted value when hydration lands. Gate on
[`useValueStatus`](#usevaluestatus) when that first frame matters, and see
[Synchronous and asynchronous](sync-vs-async.md) for why the split exists.

A refused write surfaces in the value's status, never as a throw from the
setter; the value you set stays on screen. Codec errors on encode reach the
caller. See [Errors and recovery](errors-and-recovery.md).

## useValueStatus

```ts
import type { ValueStatus } from "@priemskiyyy/silo";
import type { RegisteredKey } from "@priemskiyyy/silo-react";

useValueStatus(
  key: RegisteredKey,
  onChange?: (status: ValueStatus) => void | Promise<unknown>,
): ValueStatus
```

```ts
type ValueStatus =
  | { state: "hydrating" }
  | { state: "ready" }
  | { state: "error"; error: { phase: "hydrate" | "write"; cause: unknown } };
```

Observes one value's progress without reading the value. Nothing here
subscribes to the snapshot, so a component that only watches status does not
rerender when the value changes.

It does still reach the value, and reaching a value is what starts its
hydration. `status.get()` and `status.subscribe()` add nothing, but finding the
status means calling `scope.value(key)`, which creates the record and issues the
read. A component that watches status alone still causes exactly one read of
that key.

`error.phase` says which side failed. A `hydrate` error means the stored raw
value could not be read or decoded; it is still on disk, untouched, and
`setValue` or a removal is the recovery. A `write` error means the adapter
refused a write and the optimistic snapshot was kept.

On the server and on the hydrating render this hook returns
`{ state: "hydrating" }` from an interned constant, which is what makes it the
safe thing to gate on. See [Server rendering](server-rendering.md).

## useSiloStatus

```ts
import type { SiloStatus } from "@priemskiyyy/silo";

useSiloStatus(
  onChange?: (status: SiloStatus) => void | Promise<unknown>,
): SiloStatus
```

```ts
type SiloStatus =
  | { state: "migrating" }
  | { state: "ready" }
  | { state: "error"; error: { phase: "migrate"; cause: unknown } };
```

Observes the store itself: `migrating` while [migrations](migrations.md) run,
then `ready`, or `error` with the step that failed. A failed migration closes
the store to reads and writes, so this is the status to show a repair message
on. Observing it touches no value.

On the server and on the hydrating render it reads `migrating`, allowing a
consistent placeholder for that boundary. After React hydration it reports the
actual migration status. It does not wait for individual asynchronous values;
use `useValueStatus(key)` for those. In a client-only render with no pending
migration, the status can already be `ready`.

```tsx
import { useSiloStatus } from "@priemskiyyy/silo-react";
import type { PropsWithChildren } from "react";

export const StorageGate = ({ children }: PropsWithChildren) => {
  const status = useSiloStatus();

  if (status.state === "error") {
    return <p>Stored data needs attention: {String(status.error.cause)}</p>;
  }

  return children;
};
```

## useScope

```ts
import type { RegisteredScope } from "@priemskiyyy/silo-react";

useScope(): RegisteredScope
```

The scope the value hooks read under: the one the provider's `scope` prop
names, or the store itself at the root. It carries `value`, `scope`, `clear` and
`release`, so a component reaches the keys its siblings render without
restating the segment:

```tsx
import { useScope } from "@priemskiyyy/silo-react";

export const ClearNotebook = () => {
  const notebook = useScope();

  // Removes every declared key under this notebook and nothing outside it.
  return <button onClick={() => notebook.clear()}>Clear this notebook</button>;
};
```

`useScope().value(key)` is the same memoized handle `useValue(key)` reads, so
`flush()` on it is the durability barrier for what the hook just set. Reaching a
scope reads nothing.

## useSilo

```ts
import type { RegisteredSilo } from "@priemskiyyy/silo-react";

useSilo(): RegisteredSilo
```

The provider's store, for everything the value hooks do not cover: `scope`,
`clear`, `release`, `ready`, `flush`, `status`, `native` and `diagnostics`.

```tsx
import { useSilo } from "@priemskiyyy/silo-react";

export const SignOut = ({ userId }: { userId: string }) => {
  const silo = useSilo();

  return (
    <button onClick={() => silo.scope(`users:${userId}`).clear()}>
      Sign out
    </button>
  );
};
```

## useNativeStorage

```ts
import type { RegisteredNativeStorage } from "@priemskiyyy/silo-react";

useNativeStorage(): RegisteredNativeStorage
```

The native handles by storage name, the same object as `silo.native`: the
`Map` for `memory()`, `Storage | null` for the web storage adapters, the
`{ name, version, database() }` handle for `indexedDb()`. Each storage's type is
the union of its candidates' handles, because which candidate won is decided at
construction. The object is identity stable for the store's life, so it never
causes a rerender and there is nothing to subscribe to. It is `unknown` until
[`Register`](#register) is augmented. See [Native access](native-access.md).

```tsx
const native = useNativeStorage();
const raw =
  native.default instanceof Storage
    ? native.default.getItem("silo:theme")
    : null;
```

## Register

Every hook reads the store from context, so TypeScript cannot know which
storages, schema and adapters it carries. `Register` is the declaration-merging
target that tells it. Augment it once, next to the store:

```ts
import { Silo, value } from "@priemskiyyy/silo";
import { memory } from "@priemskiyyy/silo-memory";
import type { RegisteredKey } from "@priemskiyyy/silo-react";

export const silo = new Silo({
  storages: {
    default: {
      adapters: [memory()],
      schema: { theme: value<"light" | "dark">({ fallback: "light" }) },
    },
  },
});

declare module "@priemskiyyy/silo-react" {
  interface Register {
    silo: typeof silo;
  }
}

// Two lines that fail to compile if the augmentation did not take: without it
// RegisteredKey is `string`, which is not assignable to "theme".
const key: RegisteredKey = "theme";
export const registered: "theme" = key;
```

From then on `useValue` and `useValueStatus` accept only declared keys, `useValue`
returns each key's exact type, `useNativeStorage` returns the handles by storage
name, and `useSilo` and `useScope` return the store's own types. Nothing changes
at runtime.

| Alias                     | What it resolves to once registered                                   |
| ------------------------- | --------------------------------------------------------------------- |
| `RegisteredSilo`          | The store, `Silo<Storages>` when nothing is registered.               |
| `RegisteredStorages`      | The store's `storages` type.                                          |
| `RegisteredScope`         | `SiloScope` of those storages: `value`, `scope`, `clear`, `release`.  |
| `RegisteredKey`           | Every addressable key: default keys bare, others as `storage.key`.    |
| `RegisteredValue<TKey>`   | What one key reads as, with `undefined` when it declares no fallback. |
| `RegisteredNativeStorage` | The native handles by storage name.                                   |

The fallbacks are deliberate. Without an augmentation the key is `string`, the
value is `unknown`, and the native handles are `unknown`; a shared component
library should register nothing and keep them. A registration that does not name
a `Silo`, such as the factory function rather than its return type, falls back
the same way rather than failing, so the compile-time check beside the
augmentation is worth keeping.

The augmentation covers the whole TypeScript program, so it assumes one store
per application, which is what the rest of Silo assumes too.

## Devtools

The inspector ships as a React component that reads the store from the nearest
provider. Render it inside the provider, behind your bundler's development flag:

```tsx
import { SiloProvider } from "@priemskiyyy/silo-react";
import { SiloDevtools } from "@priemskiyyy/silo-devtools/react";

<SiloProvider silo={silo}>
  <App />
  {import.meta.env.DEV ? <SiloDevtools initialIsOpen /> : null}
</SiloProvider>;
```

It follows the provider's store when that changes and reads nothing the
application has not reached. See [Browser devtools](devtools.md).

## Strict mode

The hooks subscribe from effects and unsubscribe in their cleanup, and the
provider holds no state of its own, so a development double-invoke subscribes,
unsubscribes and subscribes again, with nothing persisted in between. The
[example application](examples.md) runs under `StrictMode`. A side effect that
must happen once per page load, such as counting a visit, belongs behind a ref
guard, as any React effect with that requirement does.

## Testing components

`createMockAdapter` from `@priemskiyyy/silo/mock` stands in for any adapter,
and `{ mode: "async", hold: true }` holds every operation open so a loading
state is observable for exactly as long as the test wants. See
[Application testing](testing.md).
