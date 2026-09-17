---
title: "Silo"
titleTemplate: "Typed, reactive persistence for TypeScript"
description: "Store typed values across browser, mobile and server backends. Silo provides reactive snapshots, framework bindings, expiry, migrations and devtools."
---

<script setup>
import { withBase } from "vitepress";
</script>

<div class="silo-mark">
  <img :src="withBase('/logo.png')" width="120" height="120" alt="" />
</div>

# Silo

**Typed, reactive persistence for TypeScript.**

Declare your stored values, choose their backends, and subscribe to changes.
Silo manages hydration, ordered writes, expiry and migrations. React, Vue,
Solid and Svelte bindings connect those values to your UI.

[Get started](getting-started.md) ·
<a :href="withBase('/demo/')" target="_blank" rel="noreferrer">Try the demo</a> ·
[GitHub](https://github.com/priemskiyyy/silo)

## A stored value

```sh
pnpm add @priemskiyyy/silo @priemskiyyy/silo-local-storage @priemskiyyy/silo-memory
```

```ts
import { Silo, value } from "@priemskiyyy/silo";
import { localStorage } from "@priemskiyyy/silo-local-storage";
import { memory } from "@priemskiyyy/silo-memory";

const silo = new Silo({
  storages: {
    default: {
      adapters: [localStorage(), memory()],
      schema: {
        theme: value<"light" | "dark">({ fallback: "light" }),
      },
    },
  },
});

const theme = silo.value("theme");
const stop = theme.subscribe(() => console.log(theme.get()));

theme.set("dark");
await theme.flush();
stop();
```

The store uses `localStorage` when available and falls back to memory.
`theme.get()` always returns a synchronous snapshot. With an asynchronous
backend such as IndexedDB, it initially returns the fallback and notifies
subscribers when hydration completes.

Handles are shared by storage and physical key. Reaching `theme` from another
component reuses its cached value and initial read.

## Choose where each value lives

One store can use several backends. Put preferences in `localStorage`, documents
in IndexedDB, filters in the URL, or credentials in a device keychain. Address
keys in the default storage as `theme` and keys elsewhere as `session.draft`.

[Compare the 23 adapters](adapters.md) for supported values, observation,
platform requirements and configuration. Adapters retain their backend's
serialization, quota and durability limits.

## Connect your framework

| Framework                              | Binding                                     |
| -------------------------------------- | ------------------------------------------- |
| [React](react.md)                      | `[value, setValue]`, with updater functions |
| [Vue](vue.md)                          | Writable computed refs for `v-model`        |
| [Solid](solid.md)                      | Accessors and setters                       |
| [Svelte](svelte.md)                    | Reactive objects with writable `.current`   |
| [Plain TypeScript](reactive-values.md) | `get()`, `set()` and `subscribe()`          |

The bindings share the core's snapshots and write behavior. They add no
persistence logic.

## Writes and failures

A local write supersedes an older hydration read. Each key has one write in
flight and one pending slot; newer writes replace the pending value.
`flush()` waits for the writes accepted before the call, including any write
that supersedes them.

Adapter failures appear on the value's status and reject its flush barrier.
The optimistic value stays in memory so the application can retry. An encoding
error still throws to the caller before anything is written.

[Read about hydration and flush](hydration-and-flush.md) ·
[Handle errors](errors-and-recovery.md)

## Manage data and lifetime

- [Schemas and codecs](schema-and-codecs.md) type and validate stored values.
- [Scopes](scopes.md) give accounts or documents separate keys. Release a
  finished scope to free its cached records without deleting stored data.
- [Expiry](ttl.md) checks deadlines when stored values are loaded.
- [Migrations](migrations.md) update older data before hydration begins.
- [Devtools](devtools.md) inspect existing records, statuses and events.

Silo stores whole values by key. For indexed queries or large binary datasets,
use the underlying database directly. For server-data fetching and caching,
use a library designed for that lifecycle.

## Try it in an application

[Fieldbook](examples.md) combines eight storages in a React notebook. Compare
backends, introduce delays or failed writes, and inspect the results in devtools.
The demo runs entirely in the browser.

<a :href="withBase('/demo/')" target="_blank" rel="noreferrer">Open Fieldbook</a> ·
[Build your own adapter](writing-an-adapter.md) ·
[Runtime architecture](internals/architecture.md)
