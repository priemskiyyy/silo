---
description: "Build a React app whose state survives a reload: declare storages and a schema, read them with hooks, scope them per user, then swap memory for localStorage."
---

<script setup>
// The demo is a separate application, not a page of this site, so these links
// leave the router rather than being handled by it.
import { withBase } from "vitepress";
</script>

# Getting started

This walkthrough adds persisted state to a React application. Start with
the memory adapter, then use `localStorage` and `sessionStorage` to keep data
across reloads.

::: tip Other frameworks
[Vue](vue.md), [Solid](solid.md) and [Svelte](svelte.md) have their own
bindings. Without a framework, use the core value handles;
[The store](silo.md) covers it.
:::

## 1. Install

In an existing React 19.2 application:

::: code-group

```sh [npm]
npm install @priemskiyyy/silo @priemskiyyy/silo-react @priemskiyyy/silo-memory
```

```sh [pnpm]
pnpm add @priemskiyyy/silo @priemskiyyy/silo-react @priemskiyyy/silo-memory
```

```sh [yarn]
yarn add @priemskiyyy/silo @priemskiyyy/silo-react @priemskiyyy/silo-memory
```

```sh [bun]
bun add @priemskiyyy/silo @priemskiyyy/silo-react @priemskiyyy/silo-memory
```

:::

[Installation](installation.md) has the package matrix and every adapter.

## 2. Declare the store

```ts
// src/silo.ts
import { Silo, value } from "@priemskiyyy/silo";
import { memory } from "@priemskiyyy/silo-memory";

type Theme = "light" | "dark";

const WEEK = 7 * 24 * 60 * 60 * 1000;

export const silo = new Silo({
  storages: {
    default: {
      adapters: [memory()],
      schema: {
        theme: value<Theme>({ fallback: "light" }),
        visits: value({ fallback: 0 }),
        banner: value<"dismissed">({ expires: { in: WEEK } }),
      },
    },
    session: {
      adapters: [memory()],
      schema: {
        draft: value({ fallback: "" }),
      },
    },
  },
});

declare module "@priemskiyyy/silo-react" {
  interface Register {
    silo: typeof silo;
  }
}
```

A store runs over named storages, each with its own schema and its own list of
candidate adapters. Keys of `default` are addressed bare, `theme`; keys of every
other storage as `storage.key`, `session.draft`. Every key is declared once.
`theme` reads as `Theme` because it has a fallback, `visits` as `number`
inferred from `0`, `banner` as `"dismissed" | undefined` because it has none,
and nothing else is a key at all.

`banner` also declares `expires: { in: WEEK }`. A value written to it carries
its expiry, and a read past that moment answers the fallback instead. Nothing
runs a timer: expiry is checked when the raw value arrives. See
[expiring values](ttl.md).

The optional `Register` augmentation tells
every hook which store this application has, so keys are checked, values are
typed, and an unknown key is a compile error. Without it the hooks still work,
with `string` keys and `unknown` values.

Create one store per application, in a module like this one. Constructing it
chooses an adapter per storage and validates the schema keys. Declared migrations
read their version metadata at startup; value reads begin when a key is reached.

## 3. Read and write it

Replace your application's `App.tsx` with:

```tsx
// src/App.tsx
import {
  SiloProvider,
  useSiloStatus,
  useValue,
  useValueStatus,
} from "@priemskiyyy/silo-react";
import { silo } from "./silo";

const ThemeToggle = () => {
  const [theme, setTheme] = useValue("theme");

  return (
    <button onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
      Theme: {theme}
    </button>
  );
};

const Visits = () => {
  const [visits, setVisits] = useValue("visits");

  return (
    <button onClick={() => setVisits((previous) => previous + 1)}>
      Visits: {visits}
    </button>
  );
};

const Draft = () => {
  const [draft, setDraft] = useValue("session.draft");
  const status = useValueStatus("session.draft");

  return (
    <label>
      Draft {status.state === "error" ? "(not saved)" : ""}
      <textarea
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
      />
    </label>
  );
};

const Banner = () => {
  const [banner, setBanner] = useValue("banner");

  if (banner === "dismissed") {
    return null;
  }

  return (
    <p>
      Welcome. <button onClick={() => setBanner("dismissed")}>Dismiss</button>
    </p>
  );
};

const Page = () => {
  const [theme] = useValue("theme");
  const status = useSiloStatus();

  if (status.state === "error") {
    return <p>Storage needs attention.</p>;
  }

  return <main data-theme={theme}>This element reads the same key.</main>;
};

export const App = () => (
  <SiloProvider silo={silo}>
    <Banner />
    <ThemeToggle />
    <Visits />
    <Draft />
    <Page />
  </SiloProvider>
);
```

Start the development server and click around. The `main` element follows the
toggle because both read the same value, not because either passes a prop:
`silo.value("theme")` is memoized per key, so every consumer subscribes to one
snapshot and one notification. The `Visits` setter takes an updater, so two
clicks in one frame count twice.

Now reload. Everything is back to `light`, `0` and an empty draft, because the
memory adapter is a `Map` in this page's process. That is step 5.

## 4. What the store did

| Call                              | Effect                                                                                               |
| --------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `new Silo({ storages })`          | Chooses one adapter per storage, validates the keys, runs migrations if any.                         |
| First `useValue("theme")`         | Creates the record for `theme` and starts hydrating it.                                              |
| Another consumer of `theme`       | Gets the same handle, the same snapshot, and no second read.                                         |
| `setTheme("dark")`                | Starts persistence and updates the snapshot. Adapter errors appear on status; encoding errors throw. |
| `useValueStatus("session.draft")` | Acquires the key, starts hydration, and subscribes only to status changes.                           |
| `useSiloStatus()`                 | Observes migrations. `migrating`, `ready`, or `error` with the failed step.                          |
| `silo.dispose()`                  | Stops notifications and hydration, and disposes every adapter.                                       |

## 5. Make it survive a reload

Change the two adapter lists in `src/silo.ts`:

```ts
// src/silo.ts
import { Silo, value } from "@priemskiyyy/silo";
import { localStorage } from "@priemskiyyy/silo-local-storage";
import { memory } from "@priemskiyyy/silo-memory";
import { sessionStorage } from "@priemskiyyy/silo-session-storage";

type Theme = "light" | "dark";

const WEEK = 7 * 24 * 60 * 60 * 1000;

export const silo = new Silo({
  storages: {
    default: {
      adapters: [localStorage(), memory()],
      schema: {
        theme: value<Theme>({ fallback: "light" }),
        visits: value({ fallback: 0 }),
        banner: value<"dismissed">({ expires: { in: WEEK } }),
      },
    },
    session: {
      adapters: [sessionStorage(), memory()],
      schema: {
        draft: value({ fallback: "" }),
      },
    },
  },
});
```

```sh
pnpm add @priemskiyyy/silo-local-storage @priemskiyyy/silo-session-storage
```

No component changes, and no type changes. Reload now and the theme, the count
and the banner are where you left them, under `silo:theme`, `silo:visits` and
`silo:banner` in `localStorage`; the draft is under `silo:draft` in
`sessionStorage`. A new tab has its own session; a duplicated tab can start
with a copy. Toggle the theme in
that second tab and the first follows, because the adapter observes the
`storage` event.

Each list is a fallback ladder. `localStorage()` answers its `available()` probe
with whether the platform has one, so on a server, or in a browser that blocks
site data, the store lands on `memory()` and the application still runs. The
adapter that won is on `silo.diagnostics`, and the [devtools](devtools.md) show
it in amber when it is the floor.

`localStorage` and `sessionStorage` are synchronous, so the very first render
already has the stored value and there is no flash of the fallback. An
asynchronous adapter such as `indexedDb()` cannot do that, and the difference
is the one thing the adapter choice really changes: see
[synchronous and asynchronous](sync-vs-async.md).

The export names shadow the DOM globals inside that module, which is why the
adapters themselves read the platform through `globalThis`. Alias them if the
module also needs the globals:
`import { localStorage as localStorageAdapter } from "@priemskiyyy/silo-local-storage"`.

## 6. Validate what comes back

A key without a codec or a schema trusts what is on disk. `value<User>()` types
the read but checks nothing at runtime. Validate data that users, extensions or
older versions of your application could have changed. Pass a [Standard Schema](https://standardschema.dev)
validator:

```sh
pnpm add zod
```

```ts
// src/silo.ts
import { value } from "@priemskiyyy/silo";
import { z } from "zod";

const userSchema = z.object({ id: z.string(), name: z.string() });

const schema = {
  user: value({ schema: userSchema }),
};
```

`user` now reads as `{ id: string; name: string } | undefined`, inferred from
the validator, and a stored value that does not match is reported as
`{ state: "error", error: { phase: "hydrate" } }` on `useValueStatus("user")`
instead of being handed to your components. The raw value is left on disk
untouched, so a `set()` is what overwrites it. Valibot and ArkType work the same
way, and a `codec` translates in both directions when the stored shape differs
from the application's. See [schema and codecs](schema-and-codecs.md).

## 7. Give each user their own keys

Pass a scope to the provider and every hook below it reads under that prefix:

```tsx
// src/App.tsx
export const App = ({ userId }: { userId: string }) => (
  <SiloProvider silo={silo} scope={`users:${userId}`}>
    <ThemeToggle />
  </SiloProvider>
);
```

The keys become `silo:users:7:theme`, one theme per account under the same
schema. Clear the declared keys at that account scope on sign-out:

```ts
await silo.scope(`users:${userId}`).clear();
```

`clear()` removes every declared key of every storage at that scope and leaves
descendants unchanged. After consumers unmount, `release()` frees the account
cache, including descendants, without deleting their data. See [scopes](scopes.md).

## Where next

- <a :href="withBase('/demo/')" target="_blank" rel="noreferrer">Open the live demo</a> for eight storages, a server in the page, and a Lab that breaks them on purpose.
- [The store](silo.md): what a `Silo` owns, and what creates demand.
- [Storages and namespaces](storages.md): candidate lists, `storage.key`
  addressing, and what a physical key looks like on each medium.
- [Choose an adapter](adapters.md): configuration and traps for every backend.
- [React](react.md): every hook, and what each one subscribes to.
- [Devtools](devtools.md): inspect records, writes and migrations in the browser.
- [Examples](examples.md): the Fieldbook source, with a notebook, a Lab and a
  realtime remote storage.
