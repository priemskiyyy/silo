<p align="center">
  <img src="https://raw.githubusercontent.com/priemskiyyy/silo/main/docs/public/logo.png" width="88" height="88" alt="Silo" />
</p>

# @priemskiyyy/silo-tauri-store

Use an existing Tauri store plugin instance with [Silo](../../core), including its change notifications.

## Installation

```sh
pnpm add @priemskiyyy/silo @priemskiyyy/silo-tauri-store @priemskiyyy/silo-memory @tauri-apps/plugin-store
```

## Create a silo

```ts
import { Silo, value } from "@priemskiyyy/silo";
import { memory } from "@priemskiyyy/silo-memory";
import { tauriStore } from "@priemskiyyy/silo-tauri-store";
import { Store } from "@tauri-apps/plugin-store";

const store = await Store.load("state.json");

const silo = new Silo({
  storages: {
    default: {
      adapters: [tauriStore({ store }), memory()],
      schema: { theme: value<"light" | "dark">({ fallback: "light" }) },
    },
  },
});
```

## Options

| Option      | Default      | Meaning                                       |
| ----------- | ------------ | --------------------------------------------- |
| `store`     | required     | A loaded `Store` or a `LazyStore`.            |
| `available` | `() => true` | Overrides the synchronous availability check. |

## Behavior

- Load the store yourself, with `Store.load` or a `LazyStore`, and hand it over. The plugin is the application's dependency, and `native` is that store.
- Autosave is the plugin's default, and `save()` stays the application's call. `dispose` releases the adapter's observers and nothing else: the file stays.
- Values pass through as the plugin's JSON, so a `Date` reads back as a string and `undefined` is a removal.
- `keys` lists everything the store holds, so a migration can enumerate this storage.
- `available()` is `true` unless `available` is given a probe of the application's own, so a candidate list can be gated at construction.
- `observe` subscribes to `onChange`. The plugin reports the adapter's own writes too, which the core treats as an echo, and a deletion as `undefined`. Subscribing goes over IPC, so a change made in the first moments after `observe` can be missed; the first read covers it.

## License

[MIT](LICENSE)
