<p align="center">
  <img src="https://raw.githubusercontent.com/priemskiyyy/silo/main/docs/public/logo.png" width="88" height="88" alt="Silo" />
</p>

# @priemskiyyy/silo-electron-store

Use an electron-store or conf instance with [Silo](../../core), including its change notifications.

## Installation

```sh
pnpm add @priemskiyyy/silo @priemskiyyy/silo-electron-store @priemskiyyy/silo-memory electron-store
```

## Create a silo

```ts
import Store from "electron-store";
import { Silo, value } from "@priemskiyyy/silo";
import { electronStore } from "@priemskiyyy/silo-electron-store";
import { memory } from "@priemskiyyy/silo-memory";

const silo = new Silo({
  storages: {
    default: {
      adapters: [electronStore({ store: new Store() }), memory()],
      schema: {
        theme: value<"light" | "dark">({ fallback: "light" }),
      },
    },
  },
});

silo.value("theme").set("dark");
console.log(silo.value("theme").get()); // "dark", read synchronously
```

## Options

| Option      | Default      | Meaning                                                                 |
| ----------- | ------------ | ----------------------------------------------------------------------- |
| `store`     | required     | An `electron-store` or `conf` instance, constructed by the application. |
| `available` | `() => true` | Overrides the synchronous availability check.                           |

## Behavior

- Construct the store yourself, in the main process, and pass it in: the file name, the encryption key, `watch` and the rest are `new Store({ ... })`. One adapter per instance, and `silo.native.default` is that instance. A `conf` instance fits the same way.
- The library reads a `.` in a key as a path into nested objects, so every key reaches the file percent encoded, dot included. `keys` decodes them back, and lists a key another writer stored under a plain name as it is. The library refuses `__proto__`, `prototype` and `constructor` as keys; a silo key only ever equals one of those under an empty namespace.
- Values pass through untouched; the library serializes them to JSON, so store what JSON can express. `undefined` is a removal, and a stored `null` stays distinct from an absent key.
- `observe` subscribes to `onDidAnyChange` and reports one change per key whose JSON differs, a removal as `undefined`. The library reports this process's own writes too, which the core treats as an echo. Changes from another process arrive only when the store was constructed with `watch: true`.
- `dispose` releases every observer still registered and nothing else. The data stays in the file.
- `available()` is `true` unless `available` is given a probe of the application's own, so a candidate list can be gated at construction.
- A renderer process reaches the store through IPC of the application's own design; this adapter runs where the instance lives.

## License

[MIT](LICENSE)
