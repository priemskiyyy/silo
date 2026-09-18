---
description: "Add a persisted value to a React app, handle loading and write errors, then add scopes, other storages, and migrations."
---

# Getting started

This guide adds a theme preference that survives a reload. It starts with a
browser React application; [Vue](vue.md), [Solid](solid.md), and
[Svelte](svelte.md) have equivalent examples. Without a framework, use the
[value handle](reactive-values.md) directly.

## 1. Install

In an existing React 19.2 application:

::: code-group

```sh [npm]
npm install @priemskiyyy/silo @priemskiyyy/silo-react @priemskiyyy/silo-local-storage zod
```

```sh [pnpm]
pnpm add @priemskiyyy/silo @priemskiyyy/silo-react @priemskiyyy/silo-local-storage zod
```

```sh [yarn]
yarn add @priemskiyyy/silo @priemskiyyy/silo-react @priemskiyyy/silo-local-storage zod
```

```sh [bun]
bun add @priemskiyyy/silo @priemskiyyy/silo-react @priemskiyyy/silo-local-storage zod
```

:::

## 2. Declare a value

```ts
// src/silo.ts
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
```

Create this store once in a browser application. `theme` reads as
`"light" | "dark"`; its fallback is used when no preference is stored. Reading
the fallback does not write it to localStorage.

`ThemeSchema` supplies the TypeScript type and validates incoming stored data.
There is no separate union to keep in sync. If the initial stored value is invalid,
Silo uses the fallback and reports a loading error without deleting the data.

Zod is optional. You can use another Standard Schema library, a codec, or a
plain typed value. See [schema and codecs](schema-and-codecs.md).

## 3. Connect a component

```tsx
// src/App.tsx
import { useValue, useValueStatus } from "@priemskiyyy/silo-react";
import { silo } from "./silo";

export const App = () => {
  const themeHandle = silo.value("theme");
  const [theme, setTheme] = useValue(themeHandle);
  const status = useValueStatus(themeHandle);

  if (status.state === "hydrating") {
    return <p>Loading preferences…</p>;
  }

  return (
    <>
      <button
        onClick={() =>
          setTheme((previous) => (previous === "dark" ? "light" : "dark"))
        }
      >
        Theme: {theme}
      </button>
      {status.state === "error" && (
        <p role="alert">
          Could not {status.error.phase === "write" ? "save" : "load"} your
          preference.
        </p>
      )}
    </>
  );
};
```

Click the button and reload. The stored theme is restored. Another component
using `silo.value("theme")` shares the same value and updates when it changes.
Passing the handle gives the hook its type without a provider or `Register`.

`localStorage` loads synchronously. An asynchronous adapter initially exposes
the fallback and updates the component when its read finishes. An updater
receives the latest snapshot, so consecutive updates compose.

### If your app renders on a server

Keep the status check above: React's `useValueStatus` reports `hydrating` on
the server and during client hydration, allowing both to render the same
placeholder. `useValue` alone does not guarantee matching HTML.

A server must create a store per request instead of sharing the module-level
instance above. Add the memory adapter for environments without browser
storage and follow the [server-rendering setup](server-rendering.md).

## 4. Choose how unavailable storage behaves

The example reports an error if localStorage cannot save. If session-only
state is acceptable, install `@priemskiyyy/silo-memory` and add it as a fallback:

```ts
import { memory } from "@priemskiyyy/silo-memory";

const adapters = [localStorage(), memory()];
```

Use this array in the storage declaration. Silo selects the first candidate
whose availability check, native access, and observer setup succeed. Every
candidate is checked, including the last. If none works, construction throws.
Selection lasts for the store's lifetime. Memory values are lost on reload.

This does not recover from every storage failure. For example, IndexedDB can
pass its availability check and then fail to open. Later failures update status
without switching adapters. See [adapter selection](adapters.md#candidate-lists-and-available).

## 5. Wait for a write when it matters

The UI updates immediately. Await `flush()` before reporting a successful save
or navigating away from an editor:

```ts
const saveTheme = async (next: "light" | "dark") => {
  const theme = silo.value("theme");
  theme.set(next);

  try {
    await theme.flush();
    return { saved: true };
  } catch (cause) {
    return { saved: false, cause };
  }
};
```

A failed write retains the edited value in memory. Call `set()` again to retry;
calling `flush()` again only checks the previous write. The
[draft recipe](recipes.md#save-a-draft-and-retry) shows this in a component.

## Add more capabilities

| When you need to…                                        | Use                                                                                          |
| -------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Keep a draft separately for each workspace               | [`scope()`](scopes.md) and the [workspace recipe](recipes.md#workspace-and-user-preferences) |
| Store tab-only data or URL filters alongside preferences | [Named storages](storages.md)                                                                |
| Rename an old key or change its stored shape             | [Migrations](migrations.md), which run before hydration                                      |
| Reject invalid stored data                               | [Standard Schema validation or a codec](schema-and-codecs.md)                                |
| Reset a value or remove stored data                      | [`remove()` and `clear()`](defaults-and-removal.md)                                          |
| Expire a value after a duration or at a deadline         | [`expires`](ttl.md)                                                                          |
| Use `useValue("theme")` throughout a component tree      | [A provider and optional type registration](react.md#a-complete-setup)                       |
| Inspect errors and storage activity                      | [Devtools](devtools.md)                                                                      |

[Fieldbook](examples.md) is a working React application combining these APIs.
