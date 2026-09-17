<p align="center">
  <img src="https://raw.githubusercontent.com/priemskiyyy/silo/main/docs/public/logo.png" width="88" height="88" alt="Silo" />
</p>

# @priemskiyyy/silo-async-storage

[AsyncStorage](https://react-native-async-storage.github.io/async-storage/) adapter for [silo](../../core): asynchronous, JSON encoded persistence on the device through `@react-native-async-storage/async-storage`.

## Installation

```sh
pnpm add @priemskiyyy/silo @priemskiyyy/silo-async-storage @priemskiyyy/silo-memory @react-native-async-storage/async-storage
```

## Create a silo

```ts
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Silo, value } from "@priemskiyyy/silo";
import { asyncStorage } from "@priemskiyyy/silo-async-storage";
import { memory } from "@priemskiyyy/silo-memory";

const silo = new Silo({
  storages: {
    default: {
      adapters: [asyncStorage({ storage: AsyncStorage }), memory()],
      schema: {
        theme: value<"light" | "dark">({ fallback: "light" }),
      },
    },
  },
});

const theme = silo.value("theme");

await theme.hydrated();
console.log(theme.get()); // the persisted value, or "light"
```

## Options

| Option      | Default      | Meaning                                                                                                                    |
| ----------- | ------------ | -------------------------------------------------------------------------------------------------------------------------- |
| `storage`   | required     | The module's default export. Only `getItem`, `setItem`, `removeItem` and `getAllKeys` are typed.                           |
| `available` | `() => true` | Replaces the probe, so a candidate list can be gated by application state at construction.                                 |
| `format`    | `JSON`       | How values become text and back. `superjson` and `devalue` fit as they are; changing it over existing data is a migration. |

## Behavior

- Pass the module's default export in. This package imports nothing from it, so it types only the four methods it calls: `getItem`, `setItem`, `removeItem` and `getAllKeys`.
- AsyncStorage holds strings, so every value is stored as text, JSON by default: a `Date` reads back as a string and `undefined` is a removal. Pass `format` (`superjson`, `devalue`, anything with `stringify` and `parse`) to change that; changing the format over existing data is a migration. Text that will not parse is reported as a hydrate error and left in place for `set` to overwrite.
- `available` defaults to always available. Pass a function to gate this candidate by application state at construction, so the next adapter in the list is chosen instead.
- `keys` lists every key the module holds, so a migration can reach scoped data.
- Nothing reports a change made elsewhere in the application, so there is no `observe`. Two silos over the same AsyncStorage do not see each other's writes until they read again.
- Android caps the database at 6MB by default; raise it with `AsyncStorage_db_size_in_MB` in `gradle.properties`.
- `dispose` holds nothing to release. The data stays.

## License

[MIT](LICENSE)
