---
description: "Vue bindings for Silo: typed values, reactive scopes, status, and native storage."
---

# Vue

Requires Vue 3.5 or newer in the Vue 3 line.

```sh
pnpm add @priemskiyyy/silo @priemskiyyy/silo-vue @priemskiyyy/silo-local-storage
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

declare module "@priemskiyyy/silo-vue" {
  interface Register {
    silo: typeof silo;
  }
}
```

Registration infers valid keys, setter inputs, and native handles. Values without
a fallback retain `undefined` in their read type.

## Read and write

```vue
<script setup lang="ts">
import { useValue, useValueStatus } from "@priemskiyyy/silo-vue";

const theme = useValue("theme");
const status = useValueStatus("theme");
</script>

<template>
  <select v-model="theme">
    <option value="light">Light</option>
    <option value="dark">Dark</option>
  </select>
  <p v-if="status.state === 'error'">The preference could not be saved.</p>
</template>
```

Place it beneath the provider:

```vue
<script setup lang="ts">
import { SiloProvider } from "@priemskiyyy/silo-vue";
import { silo } from "./storage";
import Settings from "./Settings.vue";
</script>

<template>
  <SiloProvider :silo="silo" scope="account">
    <Settings />
  </SiloProvider>
</template>
```

`useValue` returns a writable computed ref suitable for `v-model`. Other
composables return getter refs: read `.value` in script and use template
unwrapping. Pass a ref or getter for reactive keys, such as
`useValue(() => props.preferenceKey)`.

Updates use the writable property directly. For a numeric schema value:

```ts
const count = useValue("count");
count.value++;
count.value = count.value + 1;
```

Each read sees the latest core snapshot, so consecutive assignments compose
before the next render. During hydration that may be the fallback; a local write
supersedes the pending read. Function assignments remain stored values:
`callback.value = handler`.

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
