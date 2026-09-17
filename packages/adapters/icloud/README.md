<p align="center">
  <img src="https://raw.githubusercontent.com/priemskiyyy/silo/main/docs/public/logo.png" width="88" height="88" alt="Silo" />
</p>

# @priemskiyyy/silo-icloud

iCloud key-value store adapter for [silo](../../core) through [react-native-cloud-store](https://github.com/farmerpsyche/react-native-cloud-store): asynchronous, JSON encoded, and following the Apple ID across the user's devices. A change made on an iPhone reaches the same value on the iPad when iCloud delivers it. This is the experimental adapter of the set.

## Installation

```sh
pnpm add @priemskiyyy/silo @priemskiyyy/silo-icloud @priemskiyyy/silo-memory react-native-cloud-store
```

Enable the iCloud capability with the key-value store in the app's entitlements. On Expo, add the library's config plugin to `app.json` and build a development build; Expo Go cannot load it.

## Create a silo

The module is iOS only, so the adapter is listed first with `available` set from the platform, and MMKV is the floor Android lands on.

```ts
import { Silo, value } from "@priemskiyyy/silo";
import { icloud } from "@priemskiyyy/silo-icloud";
import { memory } from "@priemskiyyy/silo-memory";
import { mmkv } from "@priemskiyyy/silo-mmkv";
import { Platform } from "react-native";
import * as CloudStore from "react-native-cloud-store";
import { MMKV } from "react-native-mmkv";

const silo = new Silo({
  storages: {
    default: {
      adapters: [
        icloud({ store: CloudStore, available: () => Platform.OS === "ios" }),
        mmkv({ storage: new MMKV({ id: "app" }) }),
        memory(),
      ],
      schema: {
        theme: value<"light" | "dark">({ fallback: "light" }),
      },
    },
  },
});

const theme = silo.value("theme");

theme.subscribe(() => console.log(theme.get())); // "dark" once the iPad's write arrives
```

## Options

| Option      | Default      | Meaning                                                                                                                    |
| ----------- | ------------ | -------------------------------------------------------------------------------------------------------------------------- |
| `store`     | required     | The `react-native-cloud-store` module.                                                                                     |
| `available` | `() => true` | Replaces the probe. A cross-platform app passes `() => Platform.OS === "ios"` and lists a second adapter after this one.   |
| `format`    | `JSON`       | How values become text and back. `superjson` and `devalue` fit as they are; changing it over existing data is a migration. |

## Behavior

- iOS, iPadOS and macOS Catalyst only. The iCloud key-value capability must be enabled, and the values follow the Apple ID, so a user who signs out or switches account sees a different store.
- The store holds 1 MB in total, at most 1024 keys, and at most 1 MB per value. A write past the quota is not refused: the platform reports it later as a remote change with the quota reason, and the value stays what the device wrote.
- Every value is stored as text, JSON by default, so a `Date` reads back as a string and `undefined` is a removal. Pass `format` (`superjson`, `devalue`, anything with `stringify` and `parse`) to change that; changing the format over existing data is a migration.
- `available` is a function, so the probe can read `Platform.OS` or a feature flag at construction and let the next candidate take over.
- `keys` lists every key the store holds, other libraries' included, so a migration can reach scoped data.
- `observe` subscribes to the platform's remote change notification, which iCloud sends for changes received from other devices and never for this application's own writes. Each named key is read back and reported with its value; a change that names no keys, as on an account change or the first sync, is reported as `{ key: null }`, and every value re-reads. Changes arrive seconds to minutes after the other device wrote, and a remote change wins over a local one that had not synced yet.
- Call `kvSync()` yourself on launch and when the app returns to the foreground; the adapter never does.
- `dispose` releases the listeners and switches the native notification off. The data belongs to iCloud and stays.

## License

[MIT](LICENSE)
