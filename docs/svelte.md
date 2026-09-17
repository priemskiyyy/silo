---
description: "Svelte bindings for Silo: typed values, reactive scopes, status, and native storage."
---

# Svelte

Requires Svelte 5.7 or newer in the Svelte 5 line.

```sh
pnpm add @priemskiyyy/silo @priemskiyyy/silo-svelte @priemskiyyy/silo-local-storage
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

declare module "@priemskiyyy/silo-svelte" {
  interface Register {
    silo: typeof silo;
  }
}
```

Registration infers valid keys, setter inputs, and native handles. Values without
a fallback retain `undefined` in their read type.

## Read and write

```svelte
<script lang="ts">
  import { useValue, useValueStatus } from "@priemskiyyy/silo-svelte";

  const theme = useValue("theme");
  const status = useValueStatus("theme");
</script>

<select bind:value={theme.current}>
  <option value="light">Light</option>
  <option value="dark">Dark</option>
</select>
<p>{status.current.state}</p>
```

Place it beneath the provider:

```svelte
<script lang="ts">
  import { SiloProvider } from "@priemskiyyy/silo-svelte";
  import { silo } from "./storage";
  import Settings from "./Settings.svelte";
</script>

<SiloProvider {silo} scope="account">
  <Settings />
</SiloProvider>
```

Call utilities during component initialization. `useValue` returns a reactive
object with a writable `.current`; other utilities expose getter-only
`.current` values. Keep the object intact rather than destructuring its current
snapshot. Pass a getter for changing keys, such as `useValue(() => preferenceKey)`.

The package ships Svelte components and rune modules through the `svelte` export
condition. Use a Svelte-aware bundler, such as SvelteKit or Vite with the Svelte
plugin. The binding uses [Svelte's external subscription API](https://svelte.dev/docs/svelte/svelte-reactivity#createSubscriber).

Updates use the writable property directly. For a numeric schema value:

```ts
const count = useValue("count");
count.current++;
count.current = count.current + 1;
```

Each read sees the latest core snapshot, so consecutive assignments compose
before the next render. During hydration that may be the fallback; a local write
supersedes the pending read. Function assignments remain stored values:
`callback.current = handler`.

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
