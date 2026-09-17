---
description: "Server rendering with Silo: how browser adapters fail their probe, why lists land on memory, what the React hooks render, and how to avoid mismatches."
---

# Server rendering

## What happens on the server

A browser adapter survives a server render without a guard, because being
cold is part of the contract. Nothing runs at module import, nothing runs in
the factory call, and the platform is resolved on first use inside a
`try`/`catch`, since the `globalThis.localStorage` getter itself throws
`SecurityError` where site data is blocked.

| Adapter                              | `available()` on a server   | `get`                                        | `set` and `remove`          | `native`   |
| ------------------------------------ | --------------------------- | -------------------------------------------- | --------------------------- | ---------- |
| `localStorage()`, `sessionStorage()` | `false`                     | `undefined`, so every key reads its fallback | throw a named error         | `null`     |
| `cookie()`                           | `false`                     | `undefined`                                  | throw a named error         | `null`     |
| `searchParams()`                     | `false`                     | `undefined`                                  | throw a named error         | `null`     |
| `indexedDb()`                        | `false` without `indexedDB` | rejects, naming the database                 | reject, naming the database | the handle |
| `memory()`                           | `true`                      | reads the in-process map                     | write the map               | the `Map`  |

Two things follow.

**A candidate list lands on memory.** `[localStorage(), memory()]` chooses
`memory()` on the server, because the probe fails, so nothing throws and
every key reads its fallback or whatever the request wrote. This is the
recommended shape for every browser storage, and it is why the examples end
every list with `memory()`.

**A lone browser adapter still does not crash.** With `[localStorage()]`
alone, the last candidate is taken regardless of its probe. Reads answer
`undefined` and a write becomes a `write` error on the value's status, which
nothing on the server reads. The error names what is missing, so it is
recognizable in a log:

```
Cannot write "silo:theme" through the local-storage adapter: this environment
has no localStorage, so nothing was persisted.
```

## What the hooks render

| Hook               | Server value                                                                        |
| ------------------ | ----------------------------------------------------------------------------------- |
| `useValue`         | the value's current snapshot, which is the schema fallback unless the request wrote |
| `useValueStatus`   | `{ state: "hydrating" }`, an interned constant                                      |
| `useSiloStatus`    | `{ state: "migrating" }`, an interned constant                                      |
| `useNativeStorage` | whatever each storage's `native` is, `null` for a browser adapter                   |
| `useSilo`          | the store from the provider                                                         |

`useValue` passes the value's own `get` as React's `getServerSnapshot`. The
snapshot keeps a stable reference between changes. That prevents repeated
reads from creating new objects, but does not guarantee that server and client
markup match. The client may already hold a different persisted value.

## Hydration

React calls `getServerSnapshot` on the server and on the hydrating client
render, then re-reads the live snapshot once hydration finishes. What that
means depends on the storage's mode.

**An asynchronous storage initially exposes the fallback.** If hydration is
still pending when React hydrates the component, both sides can render that
fallback. A read that finishes earlier may already have changed the client
snapshot, so asynchronous storage alone does not guarantee matching markup.

**On a synchronous storage the hydrating render already reads storage.**
`getServerSnapshot` is the value's `get`, and on `localStorage()` that
returns the persisted value in the same frame. If the browser has a
preference the server could not know about, React reports a hydration
mismatch and regenerates the tree:

```
Hydration failed because the server rendered text didn't match the client.
```

Use a consistent placeholder for storage-dependent content during React
hydration, or provide matching initial data on the server and client.

## Gate on status

`useValueStatus` renders `{ state: "hydrating" }` on the server and on the
hydrating render, on both modes, so a component that branches on it produces
identical markup on both sides:

```tsx
import { useValue, useValueStatus } from "@priemskiyyy/silo-react";

export const Theme = () => {
  const [theme] = useValue("theme");
  const status = useValueStatus("theme");

  // Identical on the server and on the hydrating render, on either mode,
  // so nothing mismatches. The stored value arrives right after.
  if (status.state === "hydrating") {
    return <p>Loading</p>;
  }

  return <p>{String(theme)}</p>;
};
```

`useSiloStatus` reads `migrating` on the same two renders, so it is the
same kind of gate for a whole subtree. With either, a synchronous storage
hydrates with zero recoverable errors and the stored value appears on the
next render. Render a skeleton of the same shape rather than nothing, so
the swap does not move the page.

## A value that must be right in the first paint

Two answers, both outside React:

- **A cookie the server can read.** `cookie()` is the one browser storage a
  server sees on every request. Keep the preference in a `preferences`
  storage over `cookie()`, read `fieldbook:theme` from the request's cookie
  header on the server, and render it. The physical key is the cookie's
  name, so nothing has to be reverse engineered. See
  [storages and namespaces](storages.md).
- **A blocking inline script.** Read the same physical key from
  `localStorage` before React runs and set a `data-theme` attribute. Keys
  are stable and documented, and a text backend stores JSON, so the script
  is a `getItem` and a `JSON.parse` inside a `try`. The
  [recipes](recipes.md) page has the script the Fieldbook example uses.

## React Server Components

The published React bundle preserves `"use client"`, so
`@priemskiyyy/silo-react` can be imported from a server component tree with
no extra configuration. The provider and the hooks still have to be used
from client components: they are stateful and they subscribe to a store.

## Isolate requests

A `Silo` owns mutable state: one record per key per scope, each with a
snapshot, a status, a revision and a write queue. A module-level store on a
server is shared by every request and therefore by every user, and it is the
one mistake in this area that is not cosmetic.

- **In the browser, a module-level store is right.** One `Silo` per
  application, constructed once, disposed when the application is torn
  down.
- **On a server, construct per request** where a framework requires
  server-side state, over `memory()` for state that belongs to the render or
  over `redis()` for state that must outlive it. Dispose it when the
  request ends.
- **Never share a store between users.** Scoping by user with
  `silo.scope(...)` partitions keys, not the record map, and the snapshots in
  it are as shared as the store is.

```ts
import { Silo, value } from "@priemskiyyy/silo";
import { memory } from "@priemskiyyy/silo-memory";

const schema = { theme: value<"light" | "dark">({ fallback: "light" }) };

// Called once per request, never hoisted to module scope on a server.
export const createRequestSilo = () =>
  new Silo({ storages: { default: { adapters: [memory()], schema } } });
```

A `Silo` is a stateful class instance, so it cannot be passed from a server
component to a client one as a prop. Construct it in the client boundary
that renders `SiloProvider`, which is where it belongs anyway.

## Related

- [React](react.md) for the hooks and the `Register` augmentation.
- [Adapters](adapters.md) for each backend's server behavior.
- [Troubleshooting](troubleshooting.md) for the flicker and the mismatch as
  symptoms.
