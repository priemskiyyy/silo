<p align="center">
  <img src="https://raw.githubusercontent.com/priemskiyyy/silo/main/docs/public/logo.png" width="88" height="88" alt="Silo" />
</p>

# @priemskiyyy/silo-capacitor-preferences

Use Capacitor Preferences with [Silo](../../core). The application supplies the plugin instance.

## Installation

```sh
pnpm add @priemskiyyy/silo @priemskiyyy/silo-capacitor-preferences @priemskiyyy/silo-memory @capacitor/preferences
npx cap sync
```

## Create a silo

```ts
import { Preferences } from "@capacitor/preferences";
import { Silo, value } from "@priemskiyyy/silo";
import { capacitorPreferences } from "@priemskiyyy/silo-capacitor-preferences";
import { memory } from "@priemskiyyy/silo-memory";

type Theme = "light" | "dark";

const silo = new Silo({
  storages: {
    default: {
      adapters: [capacitorPreferences({ preferences: Preferences }), memory()],
      schema: { theme: value<Theme>({ fallback: "light" }) },
    },
  },
});

const theme = silo.value("theme");

theme.set("dark");
await theme.flush();
```

## Options

| Option        | Default      | Meaning                                                                                                                    |
| ------------- | ------------ | -------------------------------------------------------------------------------------------------------------------------- |
| `preferences` | required     | The `Preferences` plugin, configured by the application.                                                                   |
| `available`   | `() => true` | Overrides the synchronous availability check.                                                                              |
| `format`      | `JSON`       | How values become text and back. `superjson` and `devalue` fit as they are; changing it over existing data is a migration. |

## Behavior

- Values are text: `JSON` by default, or the `format` you pass, which is anything with `stringify` and `parse`, so `superjson` and `devalue` drop in. Anything the format cannot express does not survive, and `undefined` is a removal. Changing the format over existing data is a migration, since the stored text stays what the old format wrote.
- `available` defaults to `() => true` because the plugin was handed over. Pass your own probe to gate this candidate on application state at construction, so a list such as `[capacitorPreferences(...), memory()]` falls through when it answers `false`.
- `keys` lists everything the plugin holds, so a migration can enumerate this storage.
- On the web the plugin writes to `localStorage` under a `CapacitorStorage.` prefix; the adapter never sees the prefix.
- A preferences group is the application's choice: call `Preferences.configure({ group })` once, before constructing the store.
- Nothing reports a change from outside the adapter, so there is no `observe`.
- `dispose` leaves the underlying data and client intact: the preferences outlive the adapter.

## License

[MIT](LICENSE)
