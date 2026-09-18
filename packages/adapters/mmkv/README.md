<p align="center">
  <img src="https://raw.githubusercontent.com/priemskiyyy/silo/main/docs/public/logo.png" width="88" height="88" alt="Silo" />
</p>

# @priemskiyyy/silo-mmkv

Use an existing MMKV instance as synchronous storage for [Silo](../../core).

## Installation

```sh
pnpm add @priemskiyyy/silo @priemskiyyy/silo-mmkv @priemskiyyy/silo-memory react-native-mmkv@3
```

The example uses `react-native-mmkv@3`. This adapter expects `getString`,
`set`, `delete`, `getAllKeys` and `addOnValueChangedListener`. MMKV 4 uses
`createMMKV()` and `remove()` instead; its instance needs a compatibility
wrapper for this adapter. See the [MMKV API](https://github.com/mrousavy/react-native-mmkv#usage).

## Create a silo

```ts
import { Silo, value } from "@priemskiyyy/silo";
import { memory } from "@priemskiyyy/silo-memory";
import { mmkv } from "@priemskiyyy/silo-mmkv";
import { MMKV } from "react-native-mmkv";

const silo = new Silo({
  storages: {
    default: {
      adapters: [mmkv({ storage: new MMKV({ id: "app" }) }), memory()],
      schema: {
        theme: value<"light" | "dark">({ fallback: "light" }),
      },
    },
  },
});

const theme = silo.value("theme");

theme.set("dark");
console.log(theme.get()); // "dark", read synchronously
```

## Options

| Option      | Default      | Meaning                                                                                                                    |
| ----------- | ------------ | -------------------------------------------------------------------------------------------------------------------------- |
| `storage`   | required     | An `MMKV` instance. Its id, encryption key and path are constructor options.                                               |
| `available` | `() => true` | Overrides the synchronous availability check.                                                                              |
| `format`    | `JSON`       | How values become text and back. `superjson` and `devalue` fit as they are; changing it over existing data is a migration. |

## Behavior

- Instantiate `MMKV` yourself and pass it in. The id, the encryption key and the storage path are all constructor options of MMKV, and this package imports nothing from it. One adapter per instance.
- Every value is stored as text, JSON by default, so a `Date` reads back as a string and `undefined` is a removal. Pass `format` (`superjson`, `devalue`, anything with `stringify` and `parse`) to change that; changing the format over existing data is a migration. Text that will not parse is reported as a hydrate error and left in place for `set` to overwrite.
- `available` defaults to always available. Pass a function to gate this candidate by application state at construction, so the next adapter in the list is chosen instead.
- `keys` lists every key the instance holds, so a migration can reach scoped data.
- `observe` subscribes to `addOnValueChangedListener`. MMKV reports the key alone, so the adapter reads the value back, and it reports the application's own writes too, which the core treats as an echo. A cleared instance arrives key by key, never as one `{ key: null }` report.
- `dispose` releases the listener and nothing else. The data belongs to the instance.
- `react-native-mmkv` is a native module: Expo Go cannot load it, a development build can.

## License

[MIT](LICENSE)
