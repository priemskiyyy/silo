---
description: "Render persisted values without React hydration mismatches, create a store per request, and handle browser-only storage on the server."
---

# Server rendering

The server usually cannot read a browser's localStorage or IndexedDB. Its initial
value may differ from the browser's saved value. For React, render a consistent
placeholder while `useValueStatus` reports `hydrating`.

Create one store per server request and one for the browser application. Do not
share a mutable Silo instance between requests.

## A React setup

Install the core, React binding, localStorage adapter, and memory adapter.
Keep the store factory in a shared module:

```ts
// store.ts
import { Silo, value } from "@priemskiyyy/silo";
import { localStorage } from "@priemskiyyy/silo-local-storage";
import { memory } from "@priemskiyyy/silo-memory";

export const createSilo = () =>
  new Silo({
    storages: {
      default: {
        adapters: [localStorage(), memory()],
        schema: { theme: value<"light" | "dark">({ fallback: "light" }) },
      },
    },
  });
```

The component uses the same placeholder on the server and during React's
hydrating render:

```tsx
// App.tsx
import { useValue, useValueStatus } from "@priemskiyyy/silo-react";
import type { createSilo } from "./store";

export const App = ({ silo }: { silo: ReturnType<typeof createSilo> }) => {
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

A server entry can create and dispose the request's store around rendering:

```tsx
import { renderToString } from "react-dom/server";
import { App } from "./App";
import { createSilo } from "./store";

export const render = () => {
  const silo = createSilo();
  try {
    return renderToString(<App silo={silo} />);
  } finally {
    silo.dispose();
  }
};
```

For streaming rendering, keep the store until the stream finishes or is
cancelled. If the request writes data, await `silo.flush()` before disposal.

In the browser entry, create another instance once and pass it to the same
component:

```tsx
import { hydrateRoot } from "react-dom/client";
import { App } from "./App";
import { createSilo } from "./store";

const root = document.getElementById("root");
if (root === null) {
  throw new Error("Missing root element");
}
const silo = createSilo();
hydrateRoot(root, <App silo={silo} />);
```

The server chooses memory because localStorage is absent. The browser chooses
localStorage when its availability check passes. React initially renders the
placeholder in both environments, then reads the live status and value.

## What React reads during hydration

| Hook             | Server and hydrating client render |
| ---------------- | ---------------------------------- |
| `useValue`       | The handle's current snapshot      |
| `useValueStatus` | `{ state: "hydrating" }`           |
| `useSiloStatus`  | `{ state: "migrating" }`           |

`useValue` uses the handle's `get` for React's `getServerSnapshot`. This keeps
object identity stable but does not supply matching server and client data.
A synchronous browser read may already contain the user's preference. An
asynchronous read may also finish before React hydrates. Choose a placeholder
or arrange matching initial data on both sides.

These status snapshots are specific to the React binding. Vue, Solid, and
Svelte use their own SSR behavior; see their framework pages and coordinate
server/client values in the application's framework integration.

## Browser adapter behavior on the server

Constructing a browser adapter does not open storage. With default probes,
`[localStorage(), memory()]` selects memory when the browser API is absent.
The same pattern works for the other browser adapters.

A lone browser adapter whose probe returns `false` now makes `new Silo()` throw.
Use `[localStorage(), memory()]` for a browser-or-memory choice, or pass a server
adapter explicitly. Calling an unavailable adapter directly still follows that
adapter's raw contract; Silo checks availability before selecting it.

Selection happens once, through synchronous availability checks. It does not
retry another adapter after an asynchronous open failure. See
[adapter initialization](adapters.md#candidate-lists-and-available).

## A theme before the first paint

For a page background, even a placeholder can cause a visible color change.
Two application-level approaches are available:

- Read a preference from the request's cookie header and include it in the
  initial HTML. The browser `cookie()` adapter uses `document.cookie`; it does
  not read server request headers for you.
- Run an inline script before rendering that reads the same localStorage key
  and sets the document's theme. See the [theme recipe](recipes.md#a-theme-with-no-flash-on-a-warm-start).

Keep the script's key mapping, format, and validation consistent with the store.
If a content security policy is enabled, configure the script's nonce or hash
through the application's normal script handling.

## React Server Components

The React package includes `"use client"`. Use its hooks and provider inside a
client component. A Silo instance cannot be passed across the server-component
to client-component boundary as a serialized prop. Create the instance within
the client integration, using the framework's request and application lifecycle.

The `App` prop in the example above is for conventional React SSR, where the
server and browser construct their own instance separately.

## Related

- [React](react.md) for provider-based hooks and type registration.
- [Errors and recovery](errors-and-recovery.md) for failed reads and writes.
- [Hydration and flush](hydration-and-flush.md) for waiting on storage operations.
